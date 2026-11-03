// Runs in the page itself (not the isolated content-script world), where Prebid.js and the
// cookie banner's TCF API live. Reports ad auctions, the consent string and fingerprinting
// attempts to the content script.

interface PrebidBid {
  bidderCode: string;
  cpm: number;
  currency: string;
  auctionId: string;
}

interface PrebidAuction {
  auctionId: string;
  adUnits?: unknown[];
  bidderRequests?: { bidderCode: string }[];
  bidsReceived?: PrebidBid[];
}

interface Prebid {
  que?: (() => void)[];
  getEvents?: () => { eventType: string; args: unknown }[];
  onEvent?: (event: string, handler: (args: any) => void) => void;
}

export default defineUnlistedScript(() => {
  const post = (data: object) => window.postMessage({ __youAreTheProduct: 'page', ...data }, '*');

  const onAuctionEnd = (a: PrebidAuction) =>
    post({
      kind: 'auction',
      id: a.auctionId,
      adUnits: a.adUnits?.length ?? 0,
      bidders: [...new Set((a.bidderRequests ?? []).map((r) => r.bidderCode))],
      bids: (a.bidsReceived ?? []).map((b) => ({ bidder: b.bidderCode, cpm: b.cpm, currency: b.currency })),
    });
  const onBidWon = (b: PrebidBid) =>
    post({ kind: 'won', id: b.auctionId, bidder: b.bidderCode, cpm: b.cpm, currency: b.currency });

  const attached = new WeakSet<object>();
  const attach = (pbjs: Prebid | undefined) => {
    if (!pbjs || attached.has(pbjs)) return;
    attached.add(pbjs);
    pbjs.que ??= [];
    pbjs.que.push(() => {
      // Auctions that already ran before this script was injected.
      for (const e of pbjs.getEvents?.() ?? []) {
        if (e.eventType === 'auctionEnd') onAuctionEnd(e.args as PrebidAuction);
        if (e.eventType === 'bidWon') onBidWon(e.args as PrebidBid);
      }
      pbjs.onEvent?.('auctionEnd', onAuctionEnd);
      pbjs.onEvent?.('bidWon', onBidWon);
    });
  };

  // The consent string the cookie banner stores once you click "Accept" (IAB TCF v2).
  let tcfAttached = false;
  const attachTcf = (tcfapi: unknown) => {
    if (tcfAttached || typeof tcfapi !== 'function') return;
    tcfAttached = true;
    tcfapi('addEventListener', 2, (data: { tcString?: string; eventStatus?: string } | null, ok: boolean) => {
      if (ok && data?.tcString && (data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete')) {
        // "useractioncomplete" means the choice was made just now, on this page.
        post({ kind: 'tcf', tcString: data.tcString, justChosen: data.eventStatus === 'useractioncomplete' });
      }
    });
  };

  watchFingerprinting(post);
  watchCookies(post);

  // Prebid and the TCF API often load late (after the cookie banner), so keep looking for a while.
  const w = window as unknown as Record<string, unknown>;
  let tries = 0;
  const timer = setInterval(() => {
    for (const name of (w._pbjsGlobals as string[] | undefined) ?? ['pbjs']) attach(w[name] as Prebid | undefined);
    attachTcf(w.__tcfapi);
    if (++tries > 60) clearInterval(timer);
  }, 1000);
});

type Technique = 'canvas' | 'webgl' | 'audio' | 'fonts' | 'hardware';

/** Host of the script that called us: the first stack frame that is not this probe. */
function callerHost(): string | null {
  const own = location.origin;
  for (const line of (new Error().stack ?? '').split('\n').slice(2)) {
    const url = line.match(/(https?:\/\/[^\s)]+?):\d+:\d+/)?.[1];
    if (!url) continue;
    try {
      const u = new URL(url);
      if (u.protocol.startsWith('http')) return u.hostname || new URL(own).hostname;
    } catch {}
  }
  return null;
}

/**
 * Reports cookies that scripts set on the page's own domain (Google's _ga, Facebook's _fbp …) with their
 * attributes, so the extension can show how long these IDs are meant to last. The value is not sent.
 */
function watchCookies(post: (data: object) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  const set = descriptor?.set;
  if (!descriptor || !set) return;
  const seen = new Set<string>();
  Object.defineProperty(Document.prototype, 'cookie', {
    ...descriptor,
    set(this: Document, value: string) {
      set.call(this, value);
      try {
        const text = String(value);
        const name = text.slice(0, text.indexOf('=')).trim();
        if (!name || seen.has(name) || seen.size >= 200) return;
        seen.add(name);
        post({ kind: 'cookie', cookie: `${name}=${text.slice(text.indexOf(';'))}`.slice(0, 300) });
      } catch {}
    },
  });
}

/** What a fingerprinting call returned, to show the user what the script learned (canvas image, GPU name). */
function sampleOf(technique: Technique, result: unknown): string | undefined {
  if (typeof result !== 'string') return undefined;
  if (technique === 'canvas' && result.startsWith('data:image/') && result.length <= 20_000) return result;
  if (technique === 'webgl' && result.length <= 200) return result;
  return undefined;
}

/**
 * Wraps browser APIs that fingerprinting scripts use and reports which script used them. The wrappers
 * call the original and return its result unchanged; each (technique, script) is reported once.
 */
function watchFingerprinting(post: (data: object) => void) {
  const seen = new Set<string>();
  const report = (technique: Technique, result: unknown) => {
    const host = callerHost();
    if (!host || seen.has(`${technique}|${host}`)) return;
    seen.add(`${technique}|${host}`);
    post({ kind: 'fingerprint', technique, host, sample: sampleOf(technique, result) });
  };
  const wrap = <T extends object>(proto: T | undefined, name: keyof T, onCall: (args: unknown[]) => boolean) => {
    const original = proto?.[name];
    if (typeof original !== 'function') return;
    (proto as any)[name] = function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      try {
        if (onCall(args)) report(TECHNIQUE_OF.get(onCall)!, result);
      } catch {}
      return result;
    };
  };
  const TECHNIQUE_OF = new Map<(args: unknown[]) => boolean, Technique>();
  const on = (technique: Technique, test: (args: unknown[]) => boolean = () => true) => {
    TECHNIQUE_OF.set(test, technique);
    return test;
  };

  // Canvas: reading back pixels of drawn text or shapes gives a device-specific image.
  const canvas = on('canvas');
  wrap(HTMLCanvasElement.prototype, 'toDataURL', canvas);
  wrap(HTMLCanvasElement.prototype, 'toBlob', canvas);
  wrap(CanvasRenderingContext2D.prototype, 'getImageData', canvas);

  // WebGL: the unmasked graphics card vendor and renderer (UNMASKED_VENDOR/RENDERER_WEBGL).
  const webgl = on('webgl', (args) => args[0] === 0x9245 || args[0] === 0x9246);
  wrap(WebGLRenderingContext.prototype, 'getParameter', webgl);
  if (typeof WebGL2RenderingContext !== 'undefined') wrap(WebGL2RenderingContext.prototype, 'getParameter', webgl);

  // Audio: rendering a tone offline gives slightly different numbers on each device.
  const audio = on('audio');
  wrap(AudioBuffer.prototype, 'getChannelData', audio);
  wrap(AnalyserNode.prototype, 'getFloatFrequencyData', audio);

  // Fonts: probing many fonts one by one reveals which are installed.
  let fontChecks = 0;
  if (document.fonts) wrap(document.fonts as unknown as FontFaceSet, 'check', on('fonts', () => ++fontChecks === 20));

  // Hardware: battery state is a classic fingerprinting signal.
  if ('getBattery' in navigator) wrap(Navigator.prototype, 'getBattery' as keyof Navigator, on('hardware'));
}

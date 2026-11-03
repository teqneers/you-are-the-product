import type { Bucket } from './buckets';
import type { TabSession } from './state';

export type Choice = 'accept' | 'reject';

// Button labels of cookie banners in the extension's languages. "Reject" patterns are checked first, since many
// contain an "accept" word ("nicht zustimmen", "continuer sans accepter").
const REJECT =
  /reject|decline|deny|refuse|disagree|do not consent|don't consent|without (consent|accepting)|ohne (einwilligung|zustimmung)|nicht einwilligen|necessary only|only (strictly )?necessary|essential only|ablehnen|nicht (zu)?stimmen|nur (notwendige|erforderliche|essenzielle)|refuser|sans accepter|rechazar|solo (las )?necesarias|rifiut|solo (i )?necessari|weiger|alleen (noodzakelijk|functioneel)|odrzu|tylko (niezbędne|wymagane)|rejeitar|recusar|apenas (os )?necessários|avvisa|neka|endast nödvändiga|afvis|kun nødvendige|hylkää|vain välttämättömät|odmítnout|nesouhlas|pouze nezbytné|拒否|同意しない|거부|동의하지 않/i;
const ACCEPT =
  /accept|agree|allow all|got it|^(i )?consent\b|consent and continue|^(alle(n)? )?einwilligen\b|einwilligen und|alle(s| cookies)? zulassen|mit werbung (weiter|lesen|nutzen)|alle(s)? (annehmen|erlauben|akzeptieren)|akzeptieren|zustimmen|einverstanden|annehmen|accepter|j'accepte|tout accepter|aceptar|acepto|accett|akkoord|accepteren|toestaan|zgadzam|akceptuj|zaakceptuj|aceitar|aceito|concordo|godkänn|acceptera|tillåt alla|accepter|tillad alle|hyväksy|salli kaikki|přijmout|souhlasím|povolit vše|同意|すべて許可|受け入れ|동의|모두 허용|수락/i;

/** "accept" or "reject" for a cookie banner button label, null for anything else. */
export function choiceOf(label: string): Choice | null {
  if (REJECT.test(label)) return 'reject';
  if (ACCEPT.test(label)) return 'accept';
  return null;
}

/** Groups that, under the GDPR and ePrivacy rules, generally need consent before they may run. */
export const NEEDS_CONSENT: Bucket[] = ['session', 'ads', 'social', 'analytics', 'tracker'];

/** Grace period after the click: requests already on their way do not count as ignoring the choice. */
const GRACE_MS = 2000;

export interface ConsentVerdict {
  choice?: Choice;
  /** Owners that needed consent and were there before any choice was made. */
  beforeChoice: string[];
  /** After "Reject": owners that appeared only afterwards, or kept sending requests. */
  afterReject: string[];
}

/**
 * Which tracking happened before the user chose anything on the cookie banner, and which went on after "Reject".
 * A hint, not a legal finding: some companies may claim an exception, and the banner may have been answered on an
 * earlier visit.
 */
export function consentVerdict(session: TabSession, ownerOf: (domain: string, company: string | null) => string): ConsentVerdict | null {
  const choice = session.choice;
  // No choice yet, but a cookie banner on the page: everything that needs consent ran without it.
  const hasBanner = Object.values(session.parties).some((p) => p.bucket === 'consent') || !!session.consent;
  if (!choice && !hasBanner) return null;
  const before = new Set<string>();
  const after = new Set<string>();
  for (const [domain, p] of Object.entries(session.parties)) {
    if (!p.bucket || !NEEDS_CONSENT.includes(p.bucket)) continue;
    const owner = ownerOf(domain, p.company);
    if (!choice || p.firstSeen < choice.at) before.add(owner);
    if (choice?.kind === 'reject' && (p.firstSeen > choice.at + GRACE_MS || (p.lastSeen ?? 0) > choice.at + GRACE_MS)) after.add(owner);
  }
  return { choice: choice?.kind, beforeChoice: [...before].sort(), afterReject: [...after].sort() };
}

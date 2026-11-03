import { notifyBackground } from '@/lib/notify';

// Injects the page probe and forwards its reports (ad auctions, consent string, fingerprinting)
// to the background. All frames: fingerprinting often runs inside ad iframes.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  async main() {
    addEventListener('message', (e) => {
      if (e.source !== window || e.data?.__youAreTheProduct !== 'page') return;
      const { __youAreTheProduct, ...report } = e.data;
      notifyBackground({ type: 'page', report });
    });
    await injectScript('/page-probe.js', { keepInDom: false });
  },
});

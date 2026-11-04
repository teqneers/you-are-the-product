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
    // The site's own icon, for the overview. Safari's tabs API has no favIconUrl.
    if (window === window.top) {
      addEventListener('DOMContentLoaded', () => {
        const urls = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')]
          .map((link) => link.href)
          .filter((href) => href.startsWith('https:') && !href.endsWith('.svg'))
          .slice(0, 5);
        if (urls.length) notifyBackground({ type: 'favicon', urls });
      });
    }
    await injectScript('/page-probe.js', { keepInDom: false });
  },
});

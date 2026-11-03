import { notifyBackground } from '@/lib/notify';
import { choiceOf } from '@/lib/consent-verdict';

// Tells the background when the user first clicks on a page (usually the cookie banner), so the live view can
// show how many companies appeared after that click, and whether a click was "Accept" or "Reject" on a banner.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    // Only real user clicks count; pages can dispatch synthetic ones.
    let clicked = false;
    addEventListener(
      'click',
      (e) => {
        if (clicked || !e.isTrusted) return;
        clicked = true;
        notifyBackground({ type: 'click' });
      },
      { capture: true },
    );

    let chosen = false;
    addEventListener(
      'click',
      (e) => {
        if (chosen || !e.isTrusted) return;
        // composedPath reaches into shadow DOM, where some banners render their buttons.
        const button = e
          .composedPath()
          .find((n): n is HTMLElement => n instanceof HTMLElement && n.matches('button, a, [role="button"], input[type="button"], input[type="submit"]'));
        const label = (button?.innerText || (button as HTMLInputElement | undefined)?.value || '').trim();
        const choice = label.length <= 60 ? choiceOf(label) : null;
        if (!choice) return;
        chosen = true;
        notifyBackground({ type: 'choice', choice });
      },
      { capture: true },
    );
  },
});

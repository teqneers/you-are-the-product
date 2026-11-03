import { notifyBackground } from '@/lib/notify';
import { EMAIL } from '@/lib/form-leaks';

// Tells the background when an email address was typed into a form field (not when it was submitted), so it can
// spot trackers that read the field and send it away before the user presses "Submit". The address stays in the
// extension: the background only keeps it in memory to compare it with outgoing requests.
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    const reported = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = (target: EventTarget | null) => {
      if (!(target instanceof HTMLInputElement) || target.type === 'password' || target.type === 'hidden') return;
      const value = target.value.trim();
      if (!EMAIL.test(value) || reported.has(value)) return;
      reported.add(value);
      notifyBackground({ type: 'typed', email: value });
    };
    addEventListener(
      'input',
      (e) => {
        // composedPath() is empty once the event has been dispatched, so read the target now.
        const target = e.composedPath()[0] ?? null;
        clearTimeout(timer);
        timer = setTimeout(() => check(target), 300);
      },
      { capture: true },
    );
    addEventListener('change', (e) => check(e.composedPath()[0] ?? null), { capture: true });
    addEventListener('submit', () => notifyBackground({ type: 'submitted' }), { capture: true });
  },
});

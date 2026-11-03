import { browser } from 'wxt/browser';

/**
 * Sends a message to the background from a content script, ignoring failures. After the extension is
 * reloaded or updated, scripts in already open tabs are orphaned and every send throws
 * ("Extension context invalidated"); those tabs only recover on reload, so there is nothing to do.
 */
export function notifyBackground(message: object) {
  try {
    browser.runtime.sendMessage(message).catch(() => {});
  } catch {}
}

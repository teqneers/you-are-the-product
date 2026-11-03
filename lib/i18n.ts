import { browser } from 'wxt/browser';

import { cs } from './locales/cs';
import { da } from './locales/da';
import { de } from './locales/de';
import { en, type MessageKey, type Messages, type Text } from './locales/en';
import { es } from './locales/es';
import { fi } from './locales/fi';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { sv } from './locales/sv';

export type { MessageKey };

/** UI languages: messages, the locale used for numbers and plurals, and the name shown in the language menu. */
const LANGUAGE_INFO = {
  en: { messages: en, locale: 'en-GB', name: 'English' },
  de: { messages: de, locale: 'de-DE', name: 'Deutsch' },
  es: { messages: es, locale: 'es-ES', name: 'Español' },
  fr: { messages: fr, locale: 'fr-FR', name: 'Français' },
  it: { messages: it, locale: 'it-IT', name: 'Italiano' },
  nl: { messages: nl, locale: 'nl-NL', name: 'Nederlands' },
  pl: { messages: pl, locale: 'pl-PL', name: 'Polski' },
  pt: { messages: pt, locale: 'pt-BR', name: 'Português' },
  cs: { messages: cs, locale: 'cs-CZ', name: 'Čeština' },
  da: { messages: da, locale: 'da-DK', name: 'Dansk' },
  sv: { messages: sv, locale: 'sv-SE', name: 'Svenska' },
  fi: { messages: fi, locale: 'fi-FI', name: 'Suomi' },
  ja: { messages: ja, locale: 'ja-JP', name: '日本語' },
  ko: { messages: ko, locale: 'ko-KR', name: '한국어' },
} satisfies Record<string, { messages: Messages; locale: string; name: string }>;

export type Language = keyof typeof LANGUAGE_INFO;
export const LANGUAGES = Object.keys(LANGUAGE_INFO) as Language[];
const LANGUAGE_KEY = 'language';

/** The browser's UI language if it is one we have, otherwise English. */
function browserLanguage(): Language {
  let ui = '';
  try {
    ui = browser.i18n.getUILanguage();
  } catch {
    ui = globalThis.navigator?.language ?? '';
  }
  const prefix = ui.toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((l) => l === prefix) ?? 'en';
}

let current: Language = browserLanguage();

/** Loads the chosen language (or the browser's); call before rendering anything. */
export async function initLanguage(): Promise<Language> {
  const chosen = (await browser.storage.local.get(LANGUAGE_KEY))[LANGUAGE_KEY];
  current = LANGUAGES.includes(chosen as Language) ? (chosen as Language) : browserLanguage();
  document.documentElement.lang = current;
  return current;
}

/** Stores a language choice ('auto' follows the browser) and reloads the extension's pages. */
export async function chooseLanguage(choice: Language | 'auto') {
  if (choice === 'auto') await browser.storage.local.remove(LANGUAGE_KEY);
  else await browser.storage.local.set({ [LANGUAGE_KEY]: choice });
}

/** Reloads the page when the language is changed anywhere, since texts are rendered once. */
export function reloadOnLanguageChange() {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[LANGUAGE_KEY]) location.reload();
  });
}

export const language = () => current;
export const locale = () => LANGUAGE_INFO[current].locale;

const pluralRules = new Map<Language, Intl.PluralRules>();
const pluralForm = (count: number) => {
  if (!pluralRules.has(current)) pluralRules.set(current, new Intl.PluralRules(locale()));
  return pluralRules.get(current)!.select(count);
};

/** Translated text; plural texts pick their form by values.count, else values.n or values.sites. */
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  const text: Text = LANGUAGE_INFO[current].messages[key] ?? en[key];
  const count = Number(values.count ?? values.n ?? values.sites ?? 0);
  const template = typeof text === 'string' ? text : (text[pluralForm(count)] ?? text.other);
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

/** Map-like access by suffix, e.g. labels('bucket').ads → t('bucket.ads'). */
export function labels<K extends PropertyKey>(prefix: string): Record<K, string> {
  return new Proxy({} as Record<K, string>, {
    get: (_, key) => t(`${prefix}.${String(key)}` as MessageKey),
  });
}

/** Fills elements marked with data-i18n="key" (text) or data-i18n-title="key" (tooltip). */
export function translatePage(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n as MessageKey)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const text = t(el.dataset.i18nTitle as MessageKey);
    el.title = text;
    el.setAttribute('aria-label', text);
  });
}

/** Small select for the language, for the overview page and the side panel. */
export function languageSelect() {
  const select = document.createElement('select');
  select.className = 'language-select';
  select.title = t('common.language');
  const auto = Object.assign(document.createElement('option'), { value: 'auto', textContent: t('common.languageAuto') });
  select.append(auto, ...LANGUAGES.map((l) => Object.assign(document.createElement('option'), { value: l, textContent: LANGUAGE_INFO[l].name })));
  browser.storage.local.get(LANGUAGE_KEY).then((s) => (select.value = (s[LANGUAGE_KEY] as string) ?? 'auto'));
  select.addEventListener('change', () => chooseLanguage(select.value as Language | 'auto'));
  return select;
}

/** Turns a translated text with <strong>…</strong> into DOM nodes, without parsing it as HTML. */
export function richText(text: string): Node[] {
  return text.split(/(<strong>.*?<\/strong>)/).map((part) => {
    const bold = part.match(/^<strong>(.*)<\/strong>$/);
    return bold ? Object.assign(document.createElement('strong'), { textContent: bold[1] }) : document.createTextNode(part);
  });
}

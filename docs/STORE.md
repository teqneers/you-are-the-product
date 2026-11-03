# Store listing / Store-Texte

Screenshots (1280×800) for the stores are in [store/](store/): live view on cnn.com, cookie banner check, reach and
countries, the overview graph, and "What Google knows about you". The icon is `public/icon/128.png`.
`scripts/compose-store-screenshots.py` adds the headlines to raw captures.

*Draft / Entwurf.*

## English

**Name:** You Are The Product

**Short description (max. 132 characters):**
Shows live which companies follow you while you browse, what they learn about you and who buys your attention.

**Description:**
If you are not paying, you are the product. This extension shows what happens in the background while you
read the news or look for a recipe.

- How many companies watch on the page, and how many arrive only after you click "Accept"
- Who learns which page you read, and who gives you an ID to recognise you
- "Sold.": how many bidders your visit is offered to in ad auctions
- The same ID sent to several companies
- Your consent in plain words: how many companies you agreed to and who claims "legitimate interest"
- What ad pixels report about you: products, prices, search terms
- Email addresses taken from forms before you press Submit
- Cookie banner check: tracking before your choice and after “Reject”
- Session replay: watch your own mouse movements the way the recording service sees them
- Fingerprinting, with what it reads about you, and trackers disguised as part of the site
- How far a company reaches: share of the 10,000 most visited websites it is on
- Where your data goes: server countries, and which companies send it outside the EU
- Registered data brokers among the companies watching
- What a company could learn about you in a week: health, job, news and other sites you visited
- Accept vs Reject: how many companies tracked you after each answer
- Tracking codes in links (fbclid, gclid, utm_…), with "copy clean link"
- How long cookies are meant to recognise you ("until 2029")
- A graph of all sites and companies, also as an image and in presentation mode for classes and talks

The extension blocks nothing and sends nothing away: all data stays in your browser.

**Category:** Privacy & Security (AMO has no education category)

## Deutsch

**Name:** You Are The Product

**Kurzbeschreibung (max. 132 Zeichen):**
Zeigt live, welche Firmen dir beim Surfen folgen, was sie über dich erfahren und wer deine Aufmerksamkeit kauft.

**Beschreibung:**
Wenn du nicht bezahlst, bist du das Produkt. Diese Extension macht sichtbar, was im Hintergrund passiert,
während du Nachrichten liest oder ein Rezept suchst.

- Wie viele Firmen auf der Seite zusehen, und wie viele erst nach deinem Klick auf „Akzeptieren“ dazukommen
- Wer erfährt, welche Seite du liest, und wer dir eine ID gibt, um dich wiederzuerkennen
- „Sold.“: an wie viele Bieter dein Besuch in Werbeauktionen angeboten wird
- Dieselbe Kennung, die an mehrere Firmen geht
- Deine Einwilligung im Klartext: wie vielen Firmen du zugestimmt hast und wer sich auf „berechtigtes Interesse“ beruft
- Was Werbe-Pixel über dich melden: Produkte, Preise, Suchbegriffe
- E-Mail-Adressen, die aus Formularen abfließen, bevor du auf Absenden klickst
- Cookie-Banner-Check: Tracking vor deiner Wahl und nach „Ablehnen“
- Mitschnitt: Sieh deine eigenen Mausbewegungen so, wie der Aufzeichnungsdienst sie sieht
- Fingerprinting und als Teil der Seite getarnte Tracker
- Wie weit eine Firma reicht: auf welchem Anteil der 10.000 meistbesuchten Websites sie sitzt
- Wohin deine Daten gehen: Länder der Server, und welche Firmen sie aus der EU hinausschicken
- Registrierte Datenhändler unter den Firmen, die zusehen
- Was eine Firma in einer Woche über dich erfahren kann: Gesundheits-, Job-, Nachrichten- und andere Seiten
- Akzeptieren vs. Ablehnen: wie viele Firmen dich nach welcher Antwort verfolgt haben
- Tracking-Codes in Links (fbclid, gclid, utm_…), mit „sauberen Link kopieren“
- Wie lange Cookies dich wiedererkennen sollen („bis 2029“)
- Ein Graph aller Seiten und Firmen, auch als Bild und im Präsentationsmodus für Unterricht und Vorträge

Die Extension blockiert nichts und schickt nichts weg: Alle Daten bleiben in deinem Browser.

**Kategorie:** Datenschutz & Sicherheit / Bildung

## Chrome Web Store dashboard

Paste-ready texts for the developer dashboard (https://chrome.google.com/webstore/devconsole).

**Package:** `.output/you-are-the-product-<version>-chrome.zip` (`npm run zip`).

**Store listing tab**
- Description: the English description above (and the German one as a second language).
- Category: Privacy & Security. Language: English (add German under "Localisation").
- Store icon: `docs/store/chrome-icon-128.png` (96 px artwork with transparent padding, as Google asks).
- Screenshots: `docs/store/store-1.png` … `store-5.png` (1280×800).
- Small promo tile: `docs/store/chrome-promo-small-440x280.png`. Marquee: `docs/store/chrome-promo-marquee-1400x560.png`.
- Homepage URL: https://github.com/teqneers/you-are-the-product
- Support URL: https://github.com/teqneers/you-are-the-product/issues

**Privacy tab**
- Single purpose: Shows users which third parties the websites they visit load and what data those third parties
  receive, so they understand how they are tracked.
- `webRequest` and host permission `<all_urls>`: The extension's only purpose is to show which third parties a
  website loads and what they receive. It must observe the requests on every site the user visits. Requests are
  only read, never blocked, redirected or modified.
- `tabs`: Associates requests with the tab and site the user is looking at, shows the count on the toolbar icon,
  and reads the address of the current tab to offer a copy of the link without tracking parameters.
- `storage`: Keeps the collected statistics locally in the browser so the overview can show them across sites.
  Nothing leaves the device.
- `sidePanel`: Shows the live view next to the page while the user browses.
- Remote code: No, I am not using remote code. All code and data files are part of the package.
- Data usage: tick "Web history", "Website content", "User activity" and "Personally identifiable information"
  (typed email addresses are compared in memory only). All of it is processed locally and never transmitted.
- Certifications: tick all three (no selling, no unrelated use, no creditworthiness).
- Privacy policy URL: https://github.com/teqneers/you-are-the-product/blob/main/docs/PRIVACY.md

**Distribution tab:** Public, all regions.

**Test instructions (if asked):** No account needed. Open https://edition.cnn.com or https://www.webmd.com, click
"Accept" in the cookie banner, then click the toolbar icon; "Keep live view open" opens the side panel and "Open
overview" shows the graph.

## Notes for reviewers (addons.mozilla.org)

You Are The Product is an educational tool (used in school classes) that shows which third parties a website
loads and what they receive. It observes requests only: nothing is blocked, modified or sent anywhere.

- **Source code:** the sources zip contains `SOURCE_CODE_REVIEW.md` with the build steps (`npm ci`,
  `npm run build:firefox`, Node 24). A rebuild from the sources zip is byte-identical to the uploaded package.
- **Permissions:** `<all_urls>` + `webRequest` to read requests (observe-only listeners, `requestBody` and
  response headers only to detect what is sent and how long cookies are set to live); `tabs` to map requests to
  tabs and set the badge; `storage` for the local statistics; `dns` to detect CNAME-cloaked trackers.
- **Content scripts / page script:** `page-probe.js` runs in the page to read Prebid.js auction events and the
  TCF consent string and to notice fingerprinting API calls and script-set cookie names. The wrappers call the
  original functions and return their results unchanged.
- **Network requests of its own:** only favicons of companies and visited sites (without cookies, no redirects,
  public HTTPS hosts only). All other data (tracker list, vendor names, reach, data brokers, IP-to-country table)
  is bundled; nothing is loaded remotely and there is no remote code.
- **Linter warnings:** the two `UNSAFE_VAR_ASSIGNMENT` warnings are inside the bundled d3-selection library
  (`selection.html()`), which the extension does not call.
- **How to test:** open https://edition.cnn.com, https://www.webmd.com or https://www.welt.de, click "Accept" in the cookie banner and
  open the sidebar (toolbar icon → "Keep live view open") or the popup; "Open overview" shows the graph.

# Open decisions

As of 2026-11-03. These points need a decision before the extension is published.

## 1. IAB vendor list

Decided (2026-11-03): only vendor ids and names are **bundled** (`data/vendor-names.json`, about 40 KB, 1423
vendors from the current list merged with older versions). The extension never contacts IAB: no load on their
servers, no IP addresses of users at IAB. `npm run vendors` refreshes the file before a release. Vendors that join
later show as their number until the next release.

Still open: how and how often to refresh (for example a release per month, or a CI job); asking IAB Europe
for an OK to bundling the names, offering it as the way that relieves their servers.

Research of 2026-11-03 (primary sources; not legal advice):
- **No licence on the data.** The list itself carries no licence or terms. CC BY 3.0 covers only the specification
  text. The TCF Terms & Conditions reserve IAB's rights (8(a)) but bind registered vendors and CMPs, not readers.
  IAB's general terms of use cover iabeurope.eu, not consensu.org.
- **IAB's intent is clear, though:** the specification says "All requests for the GVL must now be server-side" and
  client-side CMPs "must not load GVL resources directly from vendor-list.consensu.org"; violators "will be
  blocked". It is addressed to CMPs and vendors, but the real risk for us is a technical block.
- **Database right (UrhG §87a ff.):** IAB likely holds one. Each user's browser downloading the public file is
  low risk; after CJEU C-762/19 (CV-Online) infringement needs a risk to recouping the investment, which an
  educational viewer does not create. Republishing it ourselves (mirror, bundle) is re-utilisation by us and
  riskier, although IAB Tech Lab's own iabgpp.com mirrors the full list on GitHub Pages.

## 2. Identifiers

- **Firefox add-on id:** decided: `you-are-the-product@teqneers.de` (set in `wxt.config.ts`, permanent).
- **Safari bundle id:** decided: `de.teqneers.YouAreTheProduct` (extension: `….Extension`), set in the Xcode
  project and the default of `scripts/create-safari-project.sh`.

## 3. Publisher and accounts

Decided: the publisher is **teqneers**. Consequences:

- **Apple:** enrol as an organisation. Needed: D-U-N-S number (look up at developer.apple.com/enroll/duns-lookup or
  upik.de), a company website, a person with signing authority. The App Store lists teqneers as the seller.
- **Chrome (EU DSA):** most likely a "trader". Name, address, email and phone of teqneers are shown in the store.
  Best use a dedicated Google account with a company address (the contact email cannot be changed later).
- **Mozilla:** account with a company email; enter "teqneers" as the developer name.
- Contact email: decided: you-are-the-product@teqneers.de (stores and privacy policy).
- Repository: decided: https://github.com/teqneers/you-are-the-product (public).

## 4. Publishing

- **Privacy policy hosting:** decided: on GitHub (public repository, link to `docs/PRIVACY.md` or GitHub Pages).
  Repository: https://github.com/teqneers/you-are-the-product. Privacy policy URL:
  https://github.com/teqneers/you-are-the-product/blob/main/docs/PRIVACY.md. Contact: you-are-the-product@teqneers.de.
- **Chrome data categories:** in the privacy tab declare at least "Web history"; check in the dashboard whether
  "Website content" and "User activity" apply too (see `docs/PUBLISHING.md`).
- **Safari scope:** decided: macOS only for now, no iOS. Open: App Store or signed distribution outside the store.
- **Firefox for Android:** possible, but without a sidebar; not planned so far.

## 5. License

- Decided: code under GPL-3.0-or-later (`LICENSE`). DuckDuckGo's tracker data stays under CC BY-NC-SA 4.0:
  non-commercial, share alike.

## 6. Design

- Icon: decided: concept 3 "In the Cart" (`docs/branding/`), in `assets/icon.svg`; `npm run icons` renders the
  browser and Safari app icons.

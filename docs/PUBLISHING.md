# Publishing

As of 2026-11-03, based on the official developer pages of Mozilla, Google and Apple. Settle the open points in
[OPEN-DECISIONS.md](OPEN-DECISIONS.md) before uploading.

## Overview

| | Firefox (AMO) | Chrome Web Store | Safari (Mac App Store) |
|---|---|---|---|
| Account | Mozilla account, free, 2FA | Google account, one-time $5, 2FA | Apple Developer Program, $99/year |
| Package | `npm run zip:firefox` | `npm run zip` | Xcode project in `safari/` |
| Source code | required (sources zip) | no | no |
| Privacy policy | not needed as long as nothing is transmitted | required (URL) | required (URL) |
| Review | automatic, usually < 24 h; manual review possible at any time | a few days to weeks; `<all_urls>` + `webRequest` get a closer look | App Review, usually a few days |

## Firefox

1. Create an account on [addons.mozilla.org](https://addons.mozilla.org/developers/) and set up two-factor
   authentication.
2. The add-on id `you-are-the-product@teqneers.de` is set in `wxt.config.ts`. **It is permanent.**
3. `npm run zip:firefox` → `.output/you-are-the-product-<version>-firefox.zip` and `…-sources.zip`.
4. On AMO: "Submit a New Add-on" → "On this site" → upload the Firefox zip.
5. When asked for source code, upload the sources zip. It contains `SOURCE_CODE_REVIEW.md` with the build steps;
   a fresh build from it is byte-identical (checked).
6. Enter the store texts from [STORE.md](STORE.md). Under "Notes for Reviewers": purpose (education), that nothing
   is blocked or transmitted, and how to test (for example open welt.de and accept the cookie banner).

Already done:
- `data_collection_permissions: { required: ["none"] }` – mandatory for new add-ons since 2025-11-03. Correct,
  because nothing leaves the device. If an export or sync is ever added, `browsingActivity` must be declared.
- `strict_min_version: 140.0` (the first version that knows the data declaration).
- Manifest V2: AMO accepts MV2 and MV3; Mozilla has not announced an end of MV2.

Sources: [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
[Add-on ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/),
[Data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/),
[Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/),
[Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)
(new version from 2026-12-01, no relevant change for us).

## Chrome

1. [Register a developer account](https://developer.chrome.com/docs/webstore/register) ($5, confirm the contact
   email, 2-step verification). The email cannot be changed later.
2. **Trader declaration (EU DSA):** a private person with a free educational project is "not a trader"; publishing
   through a company most likely makes it a "trader", and then name and contact are shown publicly.
   ([Trader disclosure](https://developer.chrome.com/docs/webstore/trader-disclosure))
3. `npm run zip` → upload `.output/you-are-the-product-<version>-chrome.zip`.
4. Fill in the **privacy tab** ([guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)):
   - Single purpose: "Shows users which third parties websites load and what data they receive."
   - Justification per permission: texts in [STORE.md](STORE.md).
   - Remote code: no.
   - Data categories: purely local processing must be declared too
     ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)). At least
     "Web history", "Website content" (request contents), "User activity" (clicks, mouse movements and key
     counts for the replay) and "Personally identifiable information" (typed email addresses, compared in memory).
   - Tick the Limited Use certifications; the Limited Use statement must be in the privacy policy.
   - URL of the privacy policy: https://teqneers.github.io/you-are-the-product/PRIVACY.html
5. Store listing: texts, at least one screenshot (1280×800), 128 px icon.

Notes: new accounts get 2 extension slots by default (since 2026-08-20). Since 2026-08-01: collect only the data
needed for the single purpose and disclose everything clearly
([policy update 2026](https://developer.chrome.com/blog/cws-policy-updates-2026)).

## Safari

1. Join the [Apple Developer Program](https://developer.apple.com/programs/enroll/) ($99/year). As a private person
   your name is shown as the seller; a company needs a D-U-N-S number.
2. The bundle id `de.teqneers.YouAreTheProduct` is set. Recreate the project if needed:
   `scripts/create-safari-project.sh`.
3. In Xcode choose the team (Signing & Capabilities, for app and extension), add an app icon and a short
   explanation in the app window (review guideline 4.2: the wrapper app needs some content).
4. Product → Archive → Distribute App → App Store Connect. Alternatively without the store: "Developer ID" (signed
   and notarised, macOS only).
5. In App Store Connect: privacy policy URL, app privacy answer **"Data Not Collected"** (data processed only on
   the device does not count as collected), review note on the access to all websites (guideline 4.4.2).

Alternative without Xcode: the [Web Extension Packager in App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
(Safari 26+, uses Xcode Cloud hours).

Safari limitations (already handled):
- No side panel: the "keep live view open" button is hidden, the big picture opens as a tab.
- No DNS access: disguised trackers only via the known list.
- The badge colour is ignored (only the text shows).
- Content scripts only run once the user grants the extension access to the website.
- `webRequest` with request bodies only from Safari 18.4 (minimum version is set); **not yet tested in real
  Safari**. To test: Safari → Settings → Advanced → "Show features for web developers", then in the Develop menu
  "Allow unsigned extensions", and run the app from Xcode.
- iOS: conflicting information on `webRequest`; the project is macOS only for now.

Sources: [Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension),
[Browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility),
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[App privacy details](https://developer.apple.com/app-store/app-privacy-details/)

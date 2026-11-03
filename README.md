# You Are The Product

[Deutsch](README.de.md)

**A browser extension that shows, live, who is watching you while you browse, what they learn and who buys your
attention.** For Chrome, Firefox and Safari (macOS). It blocks nothing. It just makes the invisible visible.

```
webmd.com, a health site. You click "Accept All".

  1 click   =  56 companies get your consent
            +  28 more claim a "legitimate interest" (no consent needed, they say)
               13 companies actually watched you on the page, 6 of them learned which page you read
                6 of them are registered data brokers: they buy and sell personal data
```

What else we saw on real sites in November 2026, with this extension (visiting from Germany, so with the EU
cookie banners):

- **CNN:** 27 companies on the front page, 5 of them ran *before* you had answered the cookie banner. 7 are
  registered data brokers, 10 received your data outside the EU.
- **The Guardian:** one click on "Accept all" gives 105 companies your consent; 19 more claim "legitimate
  interest".
- **weather.com:** 26 companies, 8 of them running before you made any choice.
- **chefkoch.de**, a German recipe site: one click gives 145 companies your consent, 59 more claim "legitimate
  interest", and Google learns which recipe list you looked at.
- **Spiegel, Stern, t-online, Welt** (German news): 1 to 3 trackers ran before you answered the banner.
- **Zalando** sends Google your page views before you consent. Without cookies, via Google's "Consent Mode":
  no cookie is set yet, but your visit is reported anyway.
- **otto.de** fingerprints your browser itself: graphics card, canvas drawing, audio processing. That
  recognises you again even after you delete your cookies.
- **On a demo shop**, Facebook received the email address you were *typing* into a newsletter field,
  Base64-encoded, before you pressed Submit. This is not hypothetical: researchers found email addresses leaving
  forms before submission on 1,844 of the top 100,000 websites when crawling from the EU, and on 2,950 from the US
  ([Leaky Forms, USENIX Security 2022](https://www.usenix.org/conference/usenixsecurity22/presentation/senol)).

Try it yourself: open any news site in a private window and watch the counter.

## Why this matters

**If you're not paying, you are the product.** Most of the web is free because your attention is sold. Not
your name, usually: a profile. Which pages you read, which products you looked at, when you are online, what
device you use. Every company on those lists can add a piece.

**Profiles are built from small things.** A recipe list on its own is harmless. A recipe list plus a
pregnancy forum, three job sites and a debt calculator is a story about you. Data brokers sell exactly these
stories. The US Federal Trade Commission studied nine of them: one had 3,000 data segments for nearly every US
consumer, with categories such as "Expectant Parent", "Diabetes Interest" and "Cholesterol Focus"
([FTC report, 2014](https://www.ftc.gov/reports/data-brokers-call-transparency-accountability-report-federal-trade-commission-may-2014)).
Nobody asked those people. Nobody told them.

**Your visit is auctioned, many times a day.** When a page with ads loads, your visit is offered to bidders in
milliseconds, together with information about you and the page. The Irish Council for Civil Liberties estimates
that the data of an average person in Europe is broadcast this way 376 times a day, in the US 747 times
([ICCL, 2022](https://www.iccl.ie/digital-data/iccl-report-on-the-scale-of-real-time-bidding-data-broadcasts-in-the-u-s-and-europe/)).
The extension shows these auctions when a site runs them in your browser: "Sold."

**Profiles decide what you see.** Which ads, which news, which offers, possibly which price. Targeting can
pick out the anxious, the lonely, the just-dumped, the deeply in debt. You never see the profile, only the
results.

**Some sites record what you do, not just where you go.** Session replay scripts capture mouse movements,
clicks and typing, so someone can later watch your visit like a video. Researchers found them on 482 of the
50,000 most visited sites back in 2017
([Princeton CITP](https://blog.citp.princeton.edu/2017/11/15/no-boundaries-exfiltration-of-personal-data-by-session-replay-scripts)).

**The cookie banner is mostly theatre.** "Accept all" is one bright button; "Reject" hides two screens away.
Many sites start tracking before you choose, and some keep going after you reject. Consent to a hundred companies
in one click is not an informed decision, and nobody expects you to read the list. The extension shows you
what actually happened, not what the banner promised.

**Your data leaves the EU.** Many of these companies process data in the US or elsewhere, under different
rules and different access by authorities. A German news site is not a German data flow.

**You can't push back against what you can't see.** That is the whole point of this extension: not fear,
but a clear view. Once you have seen it, you decide for yourself what to accept, what to reject and which
tools to use.

## What you see

Click the icon for the current page, open the side panel to keep it in view, or click "Open overview" for
everything at once.

- **Live counter and tiles.** How many companies are on this page, grouped as ads, analytics, session
  recording, social and so on, and how many arrived only after you clicked "Accept". The number is also on the
  icon.
- **Who receives what.** Which company learns the page you are reading, which one gets an ID to recognise you,
  your screen size and more. And when the *same* ID goes to several companies, so they can match you up.
- **Cookie banner check.** Trackers that ran before you made a choice, and those that kept going after
  "Reject". Plus your consent in plain words: the banner's consent string decoded into how many companies you
  agreed to and which ones claim "legitimate interest".
- **Ad pixel decoder.** What the Meta, Google, TikTok, Pinterest or Snapchat pixel reports about you: page
  viewed, added to cart, purchase with price, search terms, and your email address as a hash ("advanced
  matching"), so the ad network can link your visit to your account.
- **Typed email leak.** Companies that receive an email address you typed into a form, as text, Base64 or hash,
  even before you press Submit.
- **Session replay spotlight.** "You are being recorded": services that record mouse movements, clicks and
  typing on the page. You can replay your own last 30 seconds the way they see them.
- **Fingerprint mirror.** What fingerprinting scripts can read about your browser (graphics card, canvas, audio,
  fonts, screen, cores), the image they drew and a rough estimate in bits of how identifying it is.
- **Ad auctions ("Sold.").** Prebid auctions on the page and every bidder that received data about your visit.
- **Disguised trackers.** Trackers hiding behind a subdomain of the site itself (CNAME cloaking), so they look
  like part of the site and slip past simple blockers.
- **Overview.** A graph of all visited sites and the companies behind them: who connects the most sites,
  with ranking, PNG export and a presentation mode for class and talks.
- **14 languages.** English, German, Spanish, French, Italian, Dutch, Polish, Portuguese, Czech, Danish,
  Swedish, Finnish, Japanese and Korean.

**New, in progress:**

- **Global reach:** how many of the most visited websites a company appears on
  ([WhoTracks.me](https://whotracks.me) data).
- **Weekly profile:** which kinds of sites a company saw you on, for example health or jobs.
- **Destination countries:** where requests go, and which data leaves the EU.
- **Data broker badge:** companies listed in US state data broker registries.
- **Tracking parameters in links:** what `fbclid`, `gclid` and similar mean, copy a clean link, show redirect
  chains.
- **Cookie lifetime:** "this ID follows you until 2028".
- **Accept vs Reject:** compare the same site after accepting and after rejecting.

## Install

The extension is not in the stores yet: **Chrome Web Store, Firefox Add-ons and Mac App Store coming soon.**

Until then you can load it from a build (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for how to build):

- **Chrome:** open `chrome://extensions`, switch on "Developer mode", click "Load unpacked" and choose the
  folder `.output/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on…" and choose
  `.output/firefox-mv2/manifest.json`. Firefox removes it again when it restarts.

## Your privacy

An extension that watches trackers must not become one.

- **Everything stays in your browser.** No server, no account, no analytics. Nothing about you or the sites
  you visit is sent anywhere. "Delete all data" removes everything; uninstalling does too.
- **The only network requests it makes itself:** company and site favicons for the logos (without cookies).
  The names behind a cookie banner's consent string ship with the extension. In Firefox it also looks up DNS records of the visited site's subdomains to detect
  disguised trackers.
- **It blocks nothing.** It observes, so you can see what normally happens. To protect yourself, use a real
  blocker such as [uBlock Origin](https://github.com/gorhill/uBlock) or your browser's tracking protection
  (for example Firefox's Enhanced Tracking Protection set to "Strict"). Then watch the counter drop.

Details: [privacy policy](docs/PRIVACY.md).

## For teachers: a 10-minute exercise

Works for groups from about age 12. Each pair needs a laptop with the extension.

1. **Guess (1 min).** "How many companies do you think are watching when you open a news or health site?"
   Write the guesses on the board.
2. **Accept (3 min).** Open a *private window* (so no old cookies count), go to a big site such as `cnn.com`,
   `theguardian.com` or `webmd.com` (in Germany for example `chefkoch.de` or `spiegel.de`) and click
   "Accept all" in the cookie banner. Open the extension. How many companies? How many came only after the
   click? What does "Your consent" say?
3. **Reject (3 min).** Close the private window, open a new one, same site, this time click "Reject" (you may
   have to look for it). Count again. Did anything run before you chose? Is anyone still there after "Reject"?
4. **Talk (3 min).** Compare the numbers with the guesses. Why is "Accept" so much easier to find than "Reject"?
   Who pays for the site? What could a company learn about you from a week of browsing?

For the whole class, click "Open overview" and switch on "Presentation": the graph shows how a handful of
companies connect almost every site you visited.

## Contribute, licence, contact

- Developer documentation (build, Safari, data sources and licences, tests, publishing):
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Code: [GPL-3.0-or-later](LICENSE), published by teqneers. Tracker data from
  [DuckDuckGo Tracker Blocklists](https://github.com/duckduckgo/tracker-blocklists) under
  [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). All data sources and their licences
  are listed in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#data-sources-and-licences).
- Inspired by Mozilla's Lightbeam.
- Contact: [you-are-the-product@teqneers.de](mailto:you-are-the-product@teqneers.de)

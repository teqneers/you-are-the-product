# Feature ideas

Research of 2026-11-03: features of similar tools that this extension does not have yet, ranked by "aha" value in a
classroom demo times feasibility (observe-only `webRequest` + content scripts, no server).

| # | Idea | Seen in | Aha | Effort |
|---|---|---|---|---|
| 1 | ✅ **Pixel event decoder:** "Meta now knows you put shoes in your cart" (PageView, AddToCart, Purchase with value, hashed email via advanced matching) | [Blacklight](https://themarkup.org/blacklight/2020/09/22/how-we-built-a-real-time-privacy-inspector) | high | ~½ day |
| 2 | ✅ **Form snooping:** typed email leaves the page before Submit, as text or MD5/SHA hash | [Leaky Forms](https://homes.esat.kuleuven.be/~asenol/leaky-forms), Blacklight, Hem and Haw | very high | ~1 day |
| 3 | ✅ **Consent verdict:** trackers before any choice and still after "Reject" → "possible GDPR violation" | noyb audits, [PETS 2025](https://petsymposium.org/popets/2025/popets-2025-0138.pdf) | high | ~1 day |
| 4 | ✅ **Session replay spotlight:** "you are being recorded", replay your own mouse/keys as the vendor sees them | Blacklight, [Princeton](https://blog.citp.princeton.edu/2017/11/15/no-boundaries-exfiltration-of-personal-data-by-session-replay-scripts) | high | ~1 day |
| 5 | ✅ **Fingerprint mirror:** show the actual values read (GPU, fonts, screen, cores) with rough bits of entropy | EFF Cover Your Tracks | high | ~½ day |
| 6 | ✅ **Global reach:** "on 70 % of top sites" next to our own count | [WhoTracks.me](https://whotracks.me) (CC BY 4.0), Tracker Radar prevalence | high | ~½ day |
| 7 | ✅ **Weekly profile:** "Google saw you on 6 health and 4 job sites" | Firefox Protections Dashboard | high | ~1–2 days (needs site categories) |
| 8 | ✅ **Accept vs Reject comparison** with automatic reject | [Consent-O-Matic](https://github.com/cavi-au/Consent-O-Matic) (MIT), [autoconsent](https://github.com/duckduckgo/autoconsent) (MPL-2.0) | medium-high | ~2 days, not observe-only |
| 9 | ✅ **Destination countries:** map of where requests go, transfers outside the EU | TrackerControl, Trackography; [DB-IP Lite](https://db-ip.com/db/download/ip-to-country-lite) (CC BY 4.0) | medium-high | ~1 day |
| 10 | ✅ **Data broker badge** from the California registry | [CPPA registry](https://cppa.ca.gov/data_broker_registry/) | medium-high | ~½ day + manual matching |
| 11 | ✅ **Link decoration:** fbclid/gclid explained, redirect chains, "copy clean link" | Firefox, DuckDuckGo | medium | ~½ day |
| 12 | ✅ **Cookie lifetime:** "this ID follows you until 2028" | Blacklight | medium | ~½ day |
| 13 | **Long-term statistics:** weeks and months at a glance: companies per day, the sites that leak most, how the numbers change after blocking or rejecting more often | Firefox Protections Dashboard, Lightbeam | medium-high | ~1–2 days (needs a compact daily history) |

Licences: the project is GPL-3.0, so code from the [Blacklight collector](https://github.com/the-markup/blacklight-collector)
(GPL-3.0) could be reused. Ghostery TrackerDB and Disconnect are CC BY-NC-SA 4.0 like the DuckDuckGo data;
LeakInspector has no licence (reimplement from the paper only).

# Sprint 0 — Editorial Source Review & Correction Ledger (28 Sep 2026)

**Status:** Revised JSON is committed at `content/starter-guides.json`. This changes the repository's import package, **not the live Cloudflare D1 articles**. A human owner must perform the controlled revision import, open actual sources, inspect the resulting saved preview, record verification notes and re-publish individually. Do **not** label this file or AI's `research.verified_at` as completed human editorial review.

## Confirmed source-level findings (independent spot checks)

### Vietnam — First taxi ride
- The UK government's Vietnam travel advice discusses reputable taxis, matching vehicle/driver details for app bookings, and additional motorbike travel risks. Its driving-permit advice is **UK-specific** and must never be generalized to all travelers. Source: https://www.gov.uk/foreign-travel-advice/vietnam/safety-and-security
- Vietnam Tourism's official travel-planning page discusses ordinary taxis, ride-sharing apps and using the meter. Source: https://vietnam.travel/node/26
- The previously listed Vietnamese-language transport source could not be retrieved reliably during the audit; the revision package replaces it with the currently available general transport overview: https://vietnam.travel/node/66

**Human final checks:** Test every inline link using your own browser, confirm that source wording supports the precise statement, verify any current airport-specific pickup procedure with the particular airport/operator, review passport/licensing advice against the reader's own nationality, then record what you checked in Admin.

### Bangkok — Airport transfers in heavy rain
- TAT issued a **dated bulletin on 26 September 2026** describing rainfall/localized flooding, possible road delays and the reported airport status **at that time**. It must NEVER be presented as evidence of current-day conditions: https://www.tatnews.org/2026/09/weather-and-travel-conditions-in-bangkok-and-surrounding-areas-visitor-information/
- Thailand's official Airport Rail Link explainer describes Suvarnabhumi Airport's City Line, Phaya Thai and the historical discontinued express service. The explainer dates to **2023**, so current fares, hours and temporary disruptions require direct operator verification: https://thailand.go.th/public/issue-focus-detail/001_01_107-2
- The official government general transport guide also dates to **2023** and should be treated as background, not a real-time timetable: https://www.thailand.go.th/issue-focus-detail/002_001
- Revised package makes the historical/example framing more prominent and explicitly calls the older official guide background information.

**Human final checks:** Check TODAY's airport and rail status using relevant operator notices, remove any sentence that looks like a present-tense weather alert, validate service links and decide if you can responsibly publish an evergreen route-comparison article. **Review again within 7 days** while the historical bulletin is prominent. If unable to verify, keep the article in Review, not live.

### Singapore — Overseas bank card MRT payments
- Singapore's Land Transport Authority documents contactless cards and mobile wallets for public transport and advises travelers to use the **same card/device** entering and exiting: https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/plan_your_journey.html
- SimplyGo's official FAQ indicates a **S$0.60 foreign-bank-card administration fee per day of use for qualifying foreign-issued Mastercard/Visa cards**: https://www.simplygo.com.sg/faqs/cards-and-charms/simplygo/contactless-bank-cards
- Another SimplyGo FAQ covers an entirely **different** charge: foreign-issued card **top-ups for stored-value cards at ticketing kiosks**, currently S$1.10 for up to S$30 or 4% for larger top-ups. Those fees are NOT levied on every direct bank-card tap: https://www.simplygo.com.sg/faqs/cards-and-charms/top-ups/top-ups-via-foreign-issued-creditdebit-cards/
- Changi Airport's official transport guide documents the Changi–Tanah Merah and Changi–Expo connection options; most transit services do not operate through the night: https://www.changiairport.com/en/at-changi/transport-and-directions/leaving-the-airport.html
- Revised JSON corrects the separate fee distinction and changes the proposed category to `transport`.

**Human final checks:** Reopen operator fee pages before republishing; verify which foreign card schemes are eligible, exact per-day fee, current top-up charges and whether the route guidance still matches the airport site. Review again within **7–30 days** if fees or operating hours change.

## Exact safe production activation

1. Confirm the new Worker commit is deployed. From the site owner's Cloudflare dashboard create a D1 **backup/export** first. Preserve it outside the live Worker.
2. Download the revised `content/starter-guides.json` package directly from GitHub. Sign into your own `/admin` dashboard.
3. Open **Import content**; select the updated JSON; turn on **Apply corrections to matching existing slugs**, confirm the warning. Existing published articles are **immediately withdrawn** into Review.
4. Open each article in **All articles → Review → Preview saved article**. Open all evidence links and inspect the full text in its rendered public layout.
5. Tick all four controls only after actual review, enter a substantive claim–source evidence note and choose the next review interval (Bangkok: 7 days; other articles as appropriate). Then publish each article individually.
6. Test all three live page URLs and verify category, fee distinction and date caveats on the ACTUAL production website.
7. This process is **not complete** if the owner merely imports the JSON, if a browser preview looks attractive, or if CI passes; a human review record and re-publication are required.

*Scope note: these are source-backed spot checks, not an independent sentence-by-sentence final legal or operational verification. High-volatility statements still need the editor's timely confirmation.*

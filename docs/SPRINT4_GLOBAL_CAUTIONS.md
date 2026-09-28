# Sprint 4 — Global Travel Caution Platform

**Editorial product:** TripCaution explains practical travel difficulties and evidence-backed precautions around the world. Southeast Asia is the **first publishing priority**, not a technical or editorial limit on which countries the platform supports. Avoid ordinary tourism listicles, fear-driven risk rankings, or asserting that payment rules or crime conditions apply to an entire country without evidence.

## Six worldwide visitor problems

1. **Scams & Theft:** documented scams, theft/pickpocketing reports and practical verification, with specific locations and dated evidence when available.
2. **Payments & Money:** card acceptance by named merchant/service, local debit networks, QR interoperability, cash-only scenarios, foreign-card fees and fallback plans.
3. **Transport Difficulties:** airport arrival, ticket limitations, operator payments, disruptions and identification requirements.
4. **Local Laws & Customs:** actual authority guidance, location-specific restrictions, cultural practices without stereotyping.
5. **Safety & Health:** qualified public safety and health cautions with official dates and geographic scope.
6. **Travel Essentials:** connectivity, booking, accommodation and other avoidable hassles.

Examples are **research questions, not unverified published claims**: When does a visitor's international credit card fail at a Singapore establishment? Which NETS methods accept a tourist's particular card or app? Can an official notice substantiate a reported pickpocketing risk at a particular location? Separate Visa/Mastercard acceptance, local NETS payment rails, SGQR and merchant-level choices; one does not imply another.

## Site functionality

- `/cautions`: six global topics, accessible from the homepage and site navigation. Empty topics are non-link **Research planned** cards; the hub is noindex if every topic is empty.
- `/cautions/:topic`: includes only published articles, across any country. Empty topic pages are noindex. Prior articles retain their existing URLs and map into the new topic families without bulk recategorization.
- `/destinations`: worldwide country directory based on the curated regional lists; countries without published guides are not linked to a thin destination page. Southeast Asia remains the current editorial priority.
- Sitemap includes the global hub and only **populated** topic routes. No false category page or unverified safety warning is indexed.
- New categories are additive via `migrations/0002_global_caution_taxonomy.sql`. Existing categories stay valid and legacy guides remain visible. Apply the D1 migration **before** expecting new category names in the admin dropdown.

## Suggested article structure (not a mandatory CMS checklist)

- **The specific problem** — say which city, merchant type, route, service, passport or payment instrument is relevant. Do not generalize one person's inconvenience to a whole country.
- **When it may happen** — scope, limits and named official or direct-service evidence.
- **What a traveler can do** — at least one realistic alternative or preparation step, without promising universal acceptance or safety.
- **Sources and unresolved questions** — primary local operator or government documentation with check dates; if uncertain leave an explicit editorial flag in Admin and do not publish a material unsupported claim.

### Editorial review example: Singapore payments
Research international credit-card acceptance at a particular hawker stall or venue **separately** from whether a visitor can use a relevant NETS-branded product or SGQR app there. Confirm acceptance directly with that merchant/operator and the payment network's product-level information before publishing. Use precise conditional wording and recommend a checked fallback, such as carrying an appropriate small cash amount where legal.

## Safety and operational gates

- AI import remains **Review only**. New countries and topics never automatically publish.
- Source URLs are references, not proof that a specific sentence is true; editors must confirm each material claim and verify any national or local scope.
- Run GitHub CI and staging review of the new public pages and mobile layout. Apply the additive migration on staging; back up production D1 before the corresponding production migration.
- Site code merge is **not** proof that production D1 migrations, deployment, editorial mailbox checks or new researched worldwide articles are complete.

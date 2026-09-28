# TripCaution — Sprint 2 Southeast Asia Content / SEO / UX Audit

**Audited:** 28 September 2026 (GitHub main and public Workers.dev smoke)  
**Geographic scope:** all 11 Southeast Asian countries — Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, Philippines, Singapore, Thailand, Timor-Leste and Vietnam.  
**Method:** read current Worker/CMS/SEO code, repository starter package and 11-country source/automation files, previous release-gate documents, current GitHub CI and authenticated-free production smoke. This is a targeted technical/editorial audit, **not** a full security penetration test, independent verification of travel claims, index-status report, Search Console review or access to the owner's Cloudflare dashboard.

## Evidence snapshot

- The current regional landing page and homepage discovery display **all 11** countries and distinguish published links from honest **Research planned** placeholders. The global destination directory continues to show previously published guides from outside the region without making them new editorial priorities.
- GitHub-hosted live smoke **36394916013**, source SHA `b3a6cac3c5703668d8326a576c810aa4d05e9b79`: **15/15 public automated checks passed**. This confirms live behavior at run time; it **does not attest** to the exact deployed Cloudflare SHA, Gmail/inbox delivery, independent fact checks or owner-session testing.
- The same-SHA GitHub CI **36394916097** passed **96 JavaScript tests and five Python rotation tests**.
- The live sitemap at smoke time represented **3/11 Southeast Asian countries with published guides: Singapore, Thailand and Vietnam**. Awaiting a publicly available guide: **Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, Philippines and Timor-Leste**. This is geographic sitemap coverage, not a claim that the current articles are independently fact-checked or that their repository corrections are already applied in D1.
- The public smoke still warns that no **verified public correction inbox** is configured and the production bot ingest token is absent/invalid, so automated new-draft ingestion remains disabled.

## Fixes completed during this audit

| Area | Fix | Evidence |
|---|---|---|
| CI reliability | Reconciled three stale regressions with the intentional removal of the visible article date/approval bar. Tests still assert genuine machine-readable publication metadata, source access, preview isolation and safe handling of invalid dates. | Run `36394467767` green. |
| Historic publication date | Editing and reapproving an existing guide or an owner-approved revision import no longer erases and reassigns the guide's **original** `published_at`. Scheduled re-publication likewise uses `COALESCE`; `updated_at` still reflects the update. | Run `36394680373` green. This is a code safeguard, not retrospective repair of any earlier overwritten dates. |
| Regional draft rotation | The opt-in daily script now chooses countries **without any existing non-deleted article or draft** first, instead of rotating solely by date and repeatedly researching already-covered countries. It stops after all 11 have a candidate and awaits human quality review plus a distinct phase-2 topic list. | Five Python rotation tests + 96 JS tests passed in run `36394916097`. |
| Coverage diagnostics | Production smoke now reports actual sitemap guide count instead of counting only its first five inspected guides, plus an explicit 11-country public-coverage breakdown. It does not fail just because research is unfinished. | Live smoke `36394916013` green, 3/11 geographic public coverage. |

## Findings requiring further work

### P0 — editorial coverage and trustworthy source material

**A. Eight countries have no public guide in the live sitemap.** The 11-country hub is **correctly** labelling these places as planned rather than inventing article links, but the regional publishing goal is only at 3/11 public geographic coverage. Create **one genuinely researched, distinct guide for each missing country** before starting repetitive second/third guides on the countries already represented. Do not rush publication to achieve an arbitrary count.

**B. The current automation seeds for each country consist of just two *foreign-government travel-advice pages* (UK and Canada).** These can help establish nationality-scoped advisory context but cannot, by themselves, verify local airport pickup rules, current railway ticket conditions, card acceptance, operator fares or local visitor requirements for other passport holders. The default `curated` research mode could generate superficially source-linked but inadequate local transport drafts if enabled unchanged. Before enabling daily ingestion, build a manually opened, dated **primary-source matrix** for each planned article: destination's actual airport/transit/operator, relevant local authority, document title, claim scope and last checked date. Treat any unsupported sentence as a revision request; a HTTPS URL count is not factual corroboration.

**C. Existing live starter articles are not automatically synchronized with revised files in GitHub.** The corrected three-article starter JSON is still a separate editorial import. Confirm the **live** Vietnam/Thailand/Singapore versions include the source, timing and fee clarifications, and republish only after backup and actual source checking. Their public availability alone does not prove that those corrections were imported.

**D. The contact mailbox is not verified.** A verified correction channel is especially important for travel information that can go stale. Leave the placeholder email unexposed until an inbox actually receives and replies. Then set both Worker contact variables and verify the public Contact route. This remains a launch/operational gate, not a reason to invent a mailbox.

### P1 — operational reliability, editorial UX and sustainable SEO

**E. Automated new-draft research is currently disabled on production.** This is fail-closed and secure, not a security vulnerability. If the owner decides to enable it after the source-matrix task, configure **both** distinct GitHub and Cloudflare secrets, verify the actual available Gemini model/quota and manually run **one** dry draft import. A GitHub schedule alone does not prove working ingestion. The new first-pass selector ensures 11-country *draft* coverage only; every draft remains private until deliberate owner review.

**F. Current article pages omit visible publication and last-checked dates by design.** Publication timestamps and sources remain in meta/schema and the source list, but travelers cannot readily assess freshness by looking at the article. For a travel-precautions publication, consider **one unobtrusive, source-backed line near Sources** for the original publication date and genuine **editor-confirmed** last check, with no duplicate noisy metadata bar and no claim that Gemini's research timestamp represents human review. Confirm the desired editorial UI before changing this intentional design decision.

**G. The existing original illustrations are SVG and are deliberately not emitted as Open Graph preview images.** Make original, appropriate **1200 × 630 raster social cards** for the three live guides and later the regional hub; confirm you own or have rights to them and don't use unrelated incident photos. Upload via your chosen supported asset workflow, then validate how links render. SEO scores alone don't predict traffic, snippets or indexing.

**H. The Admin article library is limited to the latest 300 records without true server-side pagination.** Safe selected-row bulk actions are working, but some older records could become inaccessible through the list as the regional catalogue grows. Add paginated, status/country-filtered API reads before approaching this scale. Keep select-all explicitly scoped to loaded filtered rows; never turn it into an implicit mass publish of hidden database records.

**I. Some other editorial mutations still write article changes and corresponding audit entries as separate operations.** Single/bulk Publish/Schedule already use atomic D1 batches, but normal **Edit** and owner **revision import** paths still update first, audit second. To avoid partial accountability on a DB failure, convert these remaining pairs to transactions and test failure rollback. No evidence of actual data loss was observed.

**J. Related-reading fallback may recommend same-category articles outside Southeast Asia.** This is not a broken link, but it can dilute the region-first reading path. Once there are sufficient genuine local guides, prioritize other reviewed Southeast Asian pieces when the current article is in the region; keep older global content accessible from the directory.

### P2 — defer unless there is a measured user problem

**K. Mobile performance and long-term content maintenance:** Sprint 1's historic Lighthouse mobile performance baseline was 87–90; the owner opted out of more device/performance testing at that stage. Re-check after changing image formats, fonts or regional card density rather than treating that old score as proof of the current build's speed.

**L. Final canonical domain and independent indexing telemetry:** `SITE_URL` correctly targets the current Workers.dev origin in source. After acquiring/activating a permanent domain, establish one canonical host, confirm redirects, real email, Search Console and sitemap indexing. Until then, don't claim Google has indexed 11 countries simply because 11 cards appear on the site.

## Concrete first-pass content queue: the eight missing countries

| Country | First differentiated research question | Minimum *type* of primary evidence before publication |
|---|---|---|
| Cambodia | Identify the **currently operating** airport/terminal and its actual authorized ground-transfer instructions for one selected arrival city. | Airport operator, dated local operator instructions, nationality-specific current entry authority. |
| Laos | How to check Vientiane airport transfer or a chosen intercity-rail booking route, *not* both unverified in one list. | Operating airport or railway primary pages, current route and booking limitations. |
| Philippines | Find official arrival information for one Manila terminal and explain which authoritative local weather/service pages travelers should monitor. | Actual terminal/airport, named operating carrier, dated PAGASA/transport notices as needed. |
| Malaysia | Which official providers and current schedules explain the chosen KLIA-to-city route? | Airport and specific rail/bus operator websites, ticket type and timetable terms. |
| Indonesia | Choose **one** of Bali or Jakarta airports and verify actual official airport-to-city options. | Airport/operator primary sources, terminal and date boundaries, relevant official visitor notice. |
| Brunei | What first-time visitors should verify before leaving Brunei International Airport. | Airport and currently operating local transport provider/authority primary information. |
| Timor-Leste | What official arrival, insurance and route checks apply before an onward journey from Dili? | Relevant local official information plus passport-scoped consular advice; acknowledge evidence gaps. |
| Myanmar | How to find, date and interpret current official travel advisories and consular-assistance limitations. | Reader's relevant government and cross-checked dated official notices; **do not** generate an upbeat tourism itinerary or unqualified universal travel claims. |

This table is a **research backlog**, not a collection of verified facts about current airport services, current laws or an instruction to visit a destination. Coverage can proceed in any order as credible local primary evidence becomes available. One useful first guide per missing country is preferable to many generic AI drafts.

## Release and coverage gates

1. Confirm any future **latest deployment SHA** in Cloudflare against the intended green GitHub source SHA. A smoke runner can validate live HTTP behavior but cannot independently attest to the Cloudflare deployment's build provenance.
2. Human-check three existing corrected starter articles and the eight future first-pass country candidates against local primary sources. Keep every unsupported candidate private in Review.
3. Confirm actual correction-email delivery. This is independent of a syntactically valid address or a 15/15 smoke result.
4. If using the optional Gemini workflow, test one real successful authorized import after source seeds improve. Do not treat scheduled GitHub runs, model grounding links or a returned source count as factual verification.
5. Use the public smoke's **11-country coverage section** to follow progress. Only an actually published country guide advances its count, not a planned tile, a duplicate draft or a bot submission.

**Audit conclusion:** The regional site structure and protected publishing infrastructure are functioning in the observed public test. The next valuable increment is **evidence quality and eight-country publishing coverage**, followed by optional editorial trust/freshness UI and sustainable scale. The public smoke is not a substitute for factual editorial review or live owner-only production acceptance.

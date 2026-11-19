# TripCaution — 300-draft duplication and primary-source audit

**Date:** 2026-11-19  
**Scope:** Batch 001, 002 and 003 (300 English research-first drafts), ten existing researched repository reference guides, and 110 published guide pages discovered and fetched from the live public TripCaution sitemap.  
**Status:** editorial triage, not independent fact-check or permission to publish.

## Executive findings

| Check | Result |
|---|---:|
| Draft articles scanned | 300 |
| Distinct new article slugs | 300 |
| Public published articles successfully read | 110 / 110 |
| Drafts with at least one title-token overlap candidate inside the new 300 (same country, score ≥0.35) | 86 |
| Drafts with token-overlap candidates against the 10 repository reference guides | 4 |
| Drafts with title-token overlap candidates against live published guides (same country, score ≥0.35) | 8 |
| Of the above, drafts with stronger live title-token overlap (score ≥0.50) | 2 |
| Total source references in all 300 drafts after first source improvements | 639 |
| Distinct source URLs | 35 |
| References to UK and Canada country-level travel advisories | 600 |
| Additional authority/operator references | 39 |
| Additional authority/operator links cited in the actual article Markdown | 11 |
| Drafts requiring further claim-specific research | 300 |

**Important:** Token-overlap alerts are **not verified semantic duplicates**. Similar country names or shared words can create false positives. Examine intent and the full article body before merging or deleting anything.

## Published-article overlap review queue

The live published inventory was obtained on 2026-11-19 from the public sitemap and 110/110 published guide pages. All comparisons used the breadcrumb country in the article's JSON-LD to prevent cross-country title matches.

| New draft | Published article | Title-token overlap | Decision |
|---|---|---:|---|
| Questions Before a Vang Vieng River Tubing Activity | Tubing, Kayaking and River Activities in Vang Vieng: How to Judge the Risk | 0.615 | High-priority manual full-text review |
| Asking for a Boat Safety Briefing Before a Philippines Island Trip | Inter-Island Ferry Capsizes and Boat Safety in the Philippines: Overcrowding and Typhoon Swells | 0.500 | High-priority manual full-text review |
| Connecting Kuala Lumpur and Penang by Rail | Drink Spiking in Malaysia: Safer Nightlife in Kuala Lumpur and Penang | 0.462 | Likely location-word overlap; still verify intent |
| Creating an Offline Group Meeting Plan in Timor-Leste | Group Fighting in Timor-Leste: What Travelers Should Do When Local Violence Starts | 0.429 | Review scope; group-plan vs violence-response may differ |
| Planning the Bali to Nusa Penida Boat Connection | Bali–Lombok and Nusa Islands by Fast Boat: Safety Checks Before You Board | 0.400 | Review transport planning vs maritime safety intent |
| Mountain Road Journeys in Timor-Leste: Questions to Ask | Mountain Roads in Timor-Leste: Why Remote Drives Need More Planning Than the Distance Suggests | 0.375 | Compare full bodies for overlap |
| Choosing a Ha Long Bay Cruise With Clear Safety Terms | Tourist Boat Sinkings in Vietnam: What Ha Long Bay and Other Cruises Teach Travelers About Safety | 0.375 | Compare booking decisions vs safety-analysis intent |
| Questions Organizations Should Ask About Myanmar Medical Evacuation | Healthcare Collapse and Medical Evacuation Failures in Myanmar: The Peril of Injury in a Broken System | 0.353 | High-stakes source and scope review |

No article was automatically deleted, merged, or approved.

## Source-quality findings

The original source set was dominated by generic UK Foreign Office and Government of Canada destination warnings. These are important for regional risk context but are insufficient evidence for an actual airport transfer, operator timetable, ticket eligibility, local medical procedure, card fare or current venue policy.

This audit added direct citations in **11 relevant drafts**, anchored to official operator or government pages:

- Malaysia KLIA Ekspres — official operator rail-service page.
- Singapore Arrival Card — Immigration & Checkpoints Authority government service.
- Angkor admission — Angkor Enterprise ticketing authority.
- Philippines sea travel and safety briefings (two drafts) — MARINA passenger guidance.
- Changi terminal transfers — Changi Airport Group instructions.
- Singapore MRT bank-card use — SimplyGo FAQ.
- Philippines eTravel — Philippine Travel Information System FAQ.
- Vietnam e-Visa — Vietnam National Electronic Visa System.
- Changi special assistance — Changi Airport Group.
- Singapore cycling — Land Transport Authority's active mobility rules.

Source statements are deliberately narrow and are not represented as verifying every paragraph. The article's source list and Markdown now both link to the corresponding official page. All 300 drafts remain blocked for publication until further research.

## Research queue for all articles

The read-only script `scripts/audit-300-editorial.mjs` generates:
- `audit-reports/tripcaution-300-audit.json`: 300 individual records with article slug, batch number, source quality, expected responsible primary source, three topic-related decisions, risk priority, draft-to-draft matches, reference matches and any live published-title matches.
- `audit-reports/tripcaution-300-audit.md`: readable 300-row editorial research queue and top related-guide candidates.

The GitHub Actions workflow `editorial-300-audit.yml` reruns the audit on demand, for relevant PRs and when the audit script changes on main. Reports are stored in GitHub Actions artifacts for 90 days; generated audit reports are not published as website content.

### Priority rules
- **P0 (23):** immigration, legal/restricted items, medical/evacuation, Myanmar — specialist primary-source review first.
- **P1 (41):** boat/ferry, snorkeling/diving, weather, remote roads, activity safety — official operator and responsible safety authority.
- **P2 (236):** general travel guidance — obtain relevant venue/operator evidence, not generic country advice.

These are triage priorities rather than safety ratings or measures of article quality.

## Limitations and next editorial release gate

1. **110 published pages were actually compared.** This does not prove that the entire D1 database (private draft/review/deleted records) is free of duplicates. A read-only D1 export would be required for that stronger conclusion.
2. **Topical research is not complete.** A matching, authentic URL supports only claims within its scope. Every factual and time-sensitive assertion must be checked against the appropriate dated primary source.
3. **Manual semantic review is outstanding.** A strong title-token match is not enough to delete or merge an article; compare full text, intent, intended traveler and unique useful information.
4. **No publishing action.** All articles retain `REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS`. No D1 import, scheduling, media rename, R2 upload, or change to any of the 600 image prompts.
5. **Content-first release decisions:** prioritize first-person-neutral, actionable guidance with linked primary evidence, unique search intent and clear correction/updated-source procedures. Publish only approved individual articles.

**Recommended next work:** review the two strong live-title matches by reading full published and draft text, then finish source-level verification of the 23 P0 articles before releasing them. The 41 P1 articles come next; P2 articles still require verification.

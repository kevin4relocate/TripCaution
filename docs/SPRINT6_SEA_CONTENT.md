# Sprint 6 — Southeast Asia: 33 → up to 88 researched caution guides

## Definition of success

Provide useful, evidence-supported, situation-specific travel cautions for all eleven Southeast Asian countries. **Do not invent or inflate incidents to reach arbitrary publication counts.** This sprint delivers a repeatable **research-and-review production pipeline**, not 88 automatically published articles. Existing published guides stay public. Every new AI-generated draft enters the owner's private Review queue and is not considered coverage on the public site until the owner verifies and publishes it.

### Country and topic plan

Countries: Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, Philippines, Singapore, Thailand, Timor-Leste and Vietnam.

| Global reader topic | Planning capacity per country | Research slots |
| --- | ---: | --- |
| Scams & theft | 2 | A documented traveler-targeted incident/precaution; a distinct corroborated incident or prevention angle |
| Payments & money | 1 | Exactly scoped operator, card or cash acceptance issue |
| Transport | 2 | Airport/arrival; independent onward/urban route issue |
| Local laws & customs | 1 | Current visitor-specific rule from responsible authority |
| Safety & health | 1 | Precise, date- and region-appropriate official precaution |
| Travel essentials | 1 | Practical connectivity, booking or preparation difficulty |
| **Planning target** | **8** | **88 across eleven countries** |

**Phase 1** is deliberately limited to three distinct research briefs per country (transport arrival, sourced scams/theft and specific official safety guidance). Editorial target: **33 published, reviewed articles**. If an unsupported scam or safety claim has no independent reputable evidence, keep the slot unfilled and report the gap; no generic placeholder or exaggerated warning. An owner may publish another clearly supported topic instead, while recording the substitution and avoiding duplicate claims.

**Phase 2** (explicit opt-in) opens the remaining five slots. The eventual goal is **up to 88** source-supported published articles, not 88 compulsory AI-generated warnings. Wider coverage and deeper city-level problems require a separate editorial decision, not silent expansion.

### What has been implemented

- `automation/coverage.py` defines 11 × 8 separate editorial research briefs and a two-phase, least-covered-first selector. Existing nondeleted draft/review/scheduled/published articles with relevant categories count as work *already underway* so the bot does not repeatedly draft the same subject. Officially tagged Sprint 6 slot identifiers take precedence; older articles only tentatively occupy the first available matching-category slot. This is a planning estimate, **not verification of the actual subject**.
- `automation/daily.py` retains a **one-article-per-run free-tier workflow** and generates only a still-missing country/topic research brief. It stops when the private review/draft backlog reaches **6**, when at least **2** articles are already scheduled over the next two days, when it cannot read **two trustworthy source pages**, when material is insufficient or when a draft duplicates an existing title. Every output must remain in private `review` status. Do **not** automatically classify HIGH/CRITICAL: the owner must assess any risk level using source-supported scope and reason.
- The bot-only `/api/ingest/topics` now returns stored category and slot tags, permitting gap selection without a destructive D1 schema change. Editor-only `/api/admin/coverage` adds per-country/per-topic published and pipeline totals, while keeping the existing country API for backward compatibility.
- Admin Overview displays an expandable six-topic breakdown across all eleven countries, clearly distinguishing published articles from draft/pipeline records. This counts the number of published articles in the category, not source credibility, distinct incident coverage, severity distribution or conformity to every narrow slot.
- Python and JavaScript regression tests cover 33/88 math, multi-country rotation, existing legacy categories, deletion/privacy, private data access and safety gates.
- **No new D1 migration** is required for Sprint 6; it reuses Sprint 4 categories and the Sprint 5 severity fields. **No production content has been automatically published**.

### Activating the existing GitHub editorial workflow

The existing workflow `.github/workflows/daily-content.yml` runs at 18:17 UTC daily (02:17 Singapore time), **only** when the owner explicitly sets GitHub Actions repository variable `TRIPCAUTION_AUTOMATION_ENABLED=true`. Required secrets remain `GEMINI_API_KEY`, `TRIPCAUTION_INGEST_TOKEN`; required variables include `TRIPCAUTION_API_URL` (the genuine production URL), `TRIPCAUTION_RESEARCH_MODE=curated` by default and optionally `GEMINI_MODEL`. New `TRIPCAUTION_CONTENT_PHASE` defaults to **1**, enabling at most the 33-slot first pass. Change it to **2** only after the editor has reviewed quality across all eleven countries and intentionally approved wider production.

All GitHub secrets must be set in the owner's account. Never send tokens to an assistant, commit them to the repository, log API request URLs with keys or embed them in content drafts. The owner should manually run `TripCaution daily research` once and inspect the **private Review queue** before enabling its daily schedule.

**Research limitations:** The curated source catalogue currently contains two foreign government travel-advice pages per country. Those pages are nationality-specific for visa and entry rules, can omit specific scams or payment-method limitations, and are insufficient evidence for every slot. The existing model is instructed to **skip** rather than invent claims when exact, relevant evidence is missing. For detailed local safety, law, payment and transport claims, expand the curated source catalogue with legitimate, current **local authorities and specific operators** as research permits and independently check original webpages in the owner review. The tool does not perform independent factual certification or real-time alerting.

**Editorial acceptance for every article:** one genuinely differentiated traveler problem; exactly applicable destination and circumstances; primary reputable source references that actually support its material claims; practical preparation steps; explicit open uncertainties; reviewed preview; no implied first-hand eyewitness narrative, unsupported business allegations, invented incident frequency, unsupported HIGH/CRITICAL severity or national danger rankings. Date-sensitive warnings require short manual recheck windows set by Sprint 5 after qualified editor assessment.

### Rollout

1. Open PR and confirm all regression tests are green. Deploy code from `main` only after the owner elects to merge.
2. Validate deployed code using Cloudflare Build result/commit and authenticated Admin Overview; check the eleven expandable country tiles and published vs pipeline breakdown. No remote migration is required.
3. Manually trigger a **single** GitHub daily-content run with phase 1, verify its generated output remains in Admin Review, original citations work, and the editor can reject unsupported claims.
4. Enable scheduled research only once one controlled run has succeeded and the owner accepts Gemini usage. Review the six-item maximum backlog before advancing the next batch.
5. Evaluate each country's published, human-reviewed *specific* coverage. Do not interpret 33 queued drafts or a completed slot spreadsheet as 33 trustworthy public articles. After genuine phase-one completion, decide whether to opt in to phase two.

### Useful commands

```bash
npm run check
npm test
python -m unittest discover -s tests_python -v
python -m py_compile automation/coverage.py automation/daily.py
```

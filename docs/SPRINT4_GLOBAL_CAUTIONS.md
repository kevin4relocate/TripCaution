# Sprint 4 — Global Travel Caution Platform

TripCaution is **a worldwide, destination-specific guide to the problems travelers may encounter**. Southeast Asia's eleven countries remain the *first research queue*, not a technical or editorial restriction on worldwide coverage. This sprint changes the reader experience and publishing taxonomy; it does not invent incidents, assert that an entire country is dangerous or turn any country's payment information into a rule for other destinations.

## Reader experience
- The homepage now leads with **travel problems** rather than generic vacation inspiration.
- `/cautions` groups published, reviewed guides into six worldwide issue categories: **Scams & theft**, **Payments & money**, **Transport difficulties**, **Local laws & customs**, **Safety & health** and **Travel essentials**.
- `/cautions/<topic>` lists only currently published guides and optionally filters by countries with **published coverage for that topic**. Unresearched subjects display *Research planned* without counterfeit article links. Country-specific filters are nonindexable; missing standalone topics are noindex until there is published guidance.
- The existing global destination directory and previously published articles keep working. Old `tourist-traps`, `things-to-avoid`, `before-you-go`, `food`, `local-laws` and `etiquette` records remain unchanged; their visitor-facing group comes from `src/cautions.js`, with exactly one global topic per category ID.
- Global caution directory and topic URLs join the sitemap **only after** an eligible published article exists; unpublished topics never create indexable thin SEO pages.

## Editorial principle: location and situation first

For every proposed caution, editors should establish:
1. **Problem:** What *specifically* might go wrong for the traveler?
2. **Scope:** Country, city, venue/operator, route, payment network, traveler passport/card type, and validity date *where relevant*.
3. **Evidence:** A dated relevant primary source for each material factual claim, plus reliable additional sources when useful.
4. **Consequence and action:** What happens if it occurs, how to reduce the inconvenience/risk, and what realistic alternative the visitor can prepare.
5. **Uncertainty and maintenance:** What is not yet confirmed and when the article should be checked again.

For example, **cash, Visa/Mastercard, NETS and QR systems in Singapore are distinct**. Acceptance depends on the specific merchant, visitor's card/account and network participation. Research the exact operator or reliable primary payment-network documentation; never write \"NETS works everywhere\" or \"Singapore does not accept international cards\". Theft-related claims also require location/time-specific, trustworthy evidence, not stereotypes or invented incident statistics.

Every imported AI draft remains private Review. Existing owner sign-in, preview, source checks, audit logging and explicit publish/schedule confirmation remain unchanged. This sprint adds editorial guidance in Admin, not a mandatory extra publishing wizard.

## New categories and one-time database migration

Sprint 4 adds four storage categories, alongside legacy categories. After validating a protected D1 backup and a staging restore, run the normal Wrangler migration **before** allowing editors to save guides in these four categories:

```bash
npm install
bash scripts/backup-d1.sh
npx wrangler d1 migrations apply tripcaution-db --remote
```

Migration file: `migrations/0002_global_cautions.sql`. It only inserts new category rows with `INSERT OR IGNORE`; there is no delete, rename or reclassification of legacy content. Do not run a remote D1 migration on an unaudited production database or treat creating a source file as having performed a remote migration. **Repository access alone cannot establish that this operator-run Cloudflare step has occurred.**

## Release gates
- CI runs syntax, global taxonomy and page behavior tests, older security and regression suites, and Python source-rotation tests.
- Verify in staging: all six topic tiles; published-only list; destination filter; topic with no guides stays noindex; old guides unchanged; new Admin categories appear **only after** migration.
- Verify `/cautions` sitemap behavior and Google Search Console **after** your real deployment; a valid sitemap does not prove indexing.
- Run the non-destructive production smoke and compare Cloudflare's deployed SHA to the intended tested commit.
- **No fabricated country articles** are included. Source/review backlog still has eight Southeast Asian countries without independently reviewed published material in the last confirmed baseline, and an unverified contact mailbox must remain unpublished until verified.

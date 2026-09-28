# TripCaution Sprint 3 — Regional Publishing Operations

Scope: scale the private editorial workflow for the 11 Southeast Asian countries without creating unverified travel claims, thin public destination pages or automatically publishing AI material.

## Implemented
- **30-article server-side pages:** `GET /api/admin/articles?page=&status=&q=` uses bounded and stable SQL ordering, an exact status allowlist and a literal-text search using SQLite `instr` rather than pattern wildcards. The Admin UI displays total matches, previous/next controls, and bulk select-all acts **only on the loaded filtered page**. There is no global bulk action.
- **Independent publishing queue:** `GET /api/admin/queue` returns the first 100 scheduled, draft and review records sorted with scheduled entries first. A conspicuous overflow notice appears if more than 100 items exist. The complete older inventory remains accessible through the paginated article library.
- **Regional coverage pulse:** `GET /api/admin/coverage` counts **actually published** database guides in each of the 11 regional countries. It separately reports private pipeline records. Planned guides are explicitly labelled **Research planned**.
- **Related reading:** same-country published guides remain first. A Southeast Asian reader sees other published, same-category Southeast Asian guides before geographically unrelated same-category content. This is an ordering change, not a new public destination page.
- **Review backlog transparency:** if over 100 published articles exist, the dashboard warns that the current human-review queue query only scans the latest 100. Never claim all content is current based on a partial scan.

## Validation
GitHub Actions runs JS syntax, all JavaScript unit tests, starter-package metadata checks and Python regional rotation tests. `tests/sprint3-regional-ops.test.js` covers the page bounds, filter bindings, literal search, queue overflow, country coverage and private UI hooks.

## Deployment order
1. Sprint 2 reliability PR #1 has not yet been merged as of this branch's creation. Sprint 3 PR #2 intentionally **contains all changes from #1 as well** and should be reviewed/merged once, rather than blindly merging overlapping branches.
2. Back up D1. Merge Sprint 3 only after green CI. Confirm intended GitHub commit was deployed to Cloudflare.
3. Manually test the owner editor using a staging database: page 1/2, search with `%` and `_`, status filter, page-scoped bulk actions, calendar after changing library filters, and restoring a deleted draft.
4. Run the non-destructive public production smoke after deploy and confirm that its evidence artifact is uploaded.
5. Independently check the three currently live starter guides against the revised GitHub starter package; deploying code does not update production article records.

## Deliberately not claimed
The coverage dashboard reflects statuses, not manual fact verification. Eight missing-country guides have **not** been fabricated or published. Real operator sources, current official advisories and an independently confirmed editorial mailbox remain editorial/owner gates. The queue and review-due dashboards expose their 100-record boundary rather than pretending to provide unlimited maintenance coverage.

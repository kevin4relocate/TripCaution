# TripCaution editorial v3 — 300 guide review pass

## Scope and baseline
This pass reviews the 300 draft guides in `content/batch-001`, `batch-002` and `batch-003` against the longer, more substantive editorial approach used by the existing three researched starter guides (`content/READ_THE_THREE_ARTICLES.md`). It follows structural v2 in `EDITORIAL_STRUCTURE_V2.md` and **does not approve any drafts for publication**.

## What changed
- Each of the 100 Batch 001 drafts received a distinct topic brief in `content/batch-001/topic-notes.json` and expanded, topic-aware verification and fallback questions.
- Batch 002/003 intros now use the subject, situation and three decisions already stored in their `editorial-plan.json` rather than repeating a generic opener.
- Repeated long filler paragraphs (25 repeated paragraphs found at least 12 times in the initial audit) were rewritten into context-specific planning questions; the checklists no longer rely on the same six universal questions.
- `scripts/editorial-v3-rewrite.cjs` documents the deterministic editorial transformations. The result was applied to the checked-in article JSON. Content is still English, and the published-site layout continues to own article headings, hero, sidebar and TOC.

## Preserved / publication safety
- 300 article slugs, titles, planned release slots and source-array URLs remain unchanged.
- No changes to any of the 600 original visual prompts, the three JSON/CSV image manifests, existing R2 keys, existing image paths or generated WebP files.
- Existing automatic TOC, heading links, internal destination and caution-topic links, same-page sources anchor, captions, canonical/OG/article schema and related *published* guide cards continue to be handled by the current renderer.
- Every entry remains `REVIEW_REQUIRED_NOT_PUBLISHABLE_AS_IS` and has `editorial_standard_version: 3`.
- Do not trigger an automatic import or publish these content files based on a code deployment.

## Editorial gates still open — NOT READY FOR AUTOMATED PUBLICATION
1. Country-level official travel-advisory sources in the drafts are research starting points; they do **not** substantiate venue-specific claims. Verify each meaningful statement against authoritative operator, government or primary documents, recording review date and direct URL.
2. Compare semantics and search intent against existing published records in Cloudflare D1; D1 content is not contained in the repository.
3. Check destination rules and advisories that might have changed, especially Myanmar; no travel arrangement is guaranteed by these drafts.
4. Check the actual generated WebP content, watermark, object existence on R2, descriptive alt and caption match.
5. Have an editor review natural English prose for awkwardness, local specificity, repetitions, and genuine value beyond templates. A deterministic rewrite cannot replace destination expertise.

## Files
- `scripts/editorial-v3-rewrite.cjs` — reproducible editorial heuristics, no invented citations.
- `content/batch-001/topic-notes.json` — article-specific factual-neutral editorial briefs.
- `content/batch-00X/articles.json` — revised drafts.
- `tests/300-article-standardization.test.js` — topic-specific structural and boilerplate regression tests.

**Bottom line:** SEO/navigation and editorial individuality have improved. These remain **provisional research-first drafts**, not 300 individually fact-checked destination reports. A successful GitHub/Cloudflare build is not publication approval.

# TripCaution — Batch 002 (100 evergreen guides)

**Status: preliminary research drafts only. NOT published, approved or scheduled.**

## Planning and content
- **100** English evergreen articles, each with individual subject, specific steps, an illustrative scenario, an editorial source-check reminder, SEO metadata and two government travel-advisory research starting points.
- **200** detailed hero and inline image prompts, in the same moody editorial ink-and-gouache reference style as Batch 001, now with the explicit `tripcaution.com` watermark.
- Expected planning dates: **28 Feb 2027 – 7 Jun 2027**, one slot daily at 08:00 Asia/Bangkok. These are metadata, not actual D1 schedules.
- Evergreen means no fixed price, opening hours, operating schedule or live safety claim. It does **not** mean factual verification is unnecessary.

## Folder-per-batch image system
- Batch 001: `Images/Gen_001.webp` … `Images/Gen_200.webp`.
- Batch 002: **`Images/Batch-002/Gen_001.webp` … `Images/Batch-002/Gen_200.webp`**.
- Future batches: `Images/Batch-003/`, `Images/Batch-004/`, etc.; each restarts at `Gen_001`.
- Each odd image = hero/thumbnail; following even image = inline image for the same article.
- Upload target R2 names are determined by *the batch's own manifest*, not just the repeated Gen number.

## Files
- `editorial-plan.json`: country, subject, situation and three topic-specific decision checks.
- `articles.json`: draft content and planned daily dates.
- `image-manifest.json`: exact mapped R2 keys, captions, alt text, watermark and prompts.
- `image-manifest.csv`: production spreadsheet of 200 image prompts.
- `Images/Batch-002/README.md`: the empty image folder placeholder and instructions.
- `scripts/batch-002-images.py`: image validation, optional manual upload and isolated renaming.
- `.github/workflows/batch-002-images.yml`: separate manual GitHub Actions control.

## Editorial safeguard
The content emphasizes enduring procedures such as communication, access, consent, sensible alternatives and carrying essential information offline. It makes no claim that a current route/venue/price/rule remains available.

The 110 currently published guides live in remote D1 and were not available for a full semantic duplicate scan. The two linked country-level advisories are **research starting points**, not evidence proving every practical statement. Before import, obtain specific authoritative sources when needed, check factual claims and originality, and manually approve the article in CMS. Myanmar guides need additional up-to-date specialist review and are not tourism recommendations.

A successful R2 upload does **not** publish articles or schedule them. Existing live content and Batch 001 are not touched.

Images may contain the requested visual watermark after generation. Verify exact lettering manually: the text prompt does not guarantee faithful typography.

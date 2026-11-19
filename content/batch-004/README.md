# TripCaution Batch 004 — 100 evergreen English guides

**Status:** RESEARCH-FIRST EDITORIAL DRAFTS. Not independently verified or approved. Publication is controlled by the existing owner-requested GitHub daily release calendar, and requires both R2 images.

- 100 guides: 10 countries x 10 unique topics, excluding Myanmar.
- Individual planning situation, three decision checks, scenario, destination context, 856–915 words per guide, SEO title and description, internal routes, a same-page reference anchor and two country-advisory research starting points.
- 200 distinct editorial gouache-and-ink image prompts with exact `tripcaution.com` watermark request: 1 hero + 1 inline per article.
- Initial image files belong in `Images/Batch-004/Gen_001.webp` through `Gen_200.webp`.
- Manifest assigns separate SEO filenames and unique `editorial/...` R2 keys, preserving all prior 600 image mappings.
- Dates: **2027-09-16 through 2027-12-24**, daily at 08:00 Vietnam (01:00 UTC), immediately after Batch 003.
- `image-manifest.json`, `image-manifest.csv`, `editorial-plan.json`, `articles.json` contain the production inputs.
- `.github/workflows/batch-004-images.yml` offers separate manually triggered preview/upload actions.

**Workflow:** Upload the 200 real WebP files to `Images/Batch-004/` in GitHub (uploading in smaller groups is fine), then launch the Batch 004 workflow in preview mode; once all 200 validate, run upload with confirmation `UPLOAD`. The upload verifies R2 hashes and writes renamed GitHub copies to an isolated `media/batch-004-processed` branch, not to `main`.

**Editorial caveat:** Most guides link only to UK and Canadian country advisories. These are not sufficient to prove specific venue or operator statements. Verify each meaningful claim from a dated primary source and review for overlapping intent with live and private D1 guides before publication. Do not present the article as reviewed. The automatic daily release is owner-directed, not an editorial approval mechanism.

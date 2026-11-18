# TripCaution Images — batch 001

Upload **200 separate WebP images** here named exactly `Gen_001.webp` to `Gen_200.webp`.

**Pairing:** odd number = article hero / thumbnail; following even number = inline image for the same article. Thus `Gen_001.webp` and `Gen_002.webp` are article #1; `Gen_199.webp` and `Gen_200.webp` are article #100.

See `../content/batch-001/image-manifest.csv` for the exact assigned title, image prompt, SEO caption, alt text and final R2 object key.

The production image path format is `/media/editorial/<article-slug>.webp` and `/media/editorial/<article-slug>-inline-01.webp`.

**Do not upload the 200 images yet if you only have the content branch URL:** after this PR is merged, use the main branch `Images/` folder. GitHub Actions upload is manual by design, dry-run by default; images are not sent to R2 just by pushing a GitHub file.

If your image tool exports PNG or JPEG, convert locally to genuine WebP before uploading, not simply renaming the extension.

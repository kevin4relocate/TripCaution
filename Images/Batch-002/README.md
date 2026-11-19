# TripCaution — Batch 002 images

Upload all **200 genuine WebP images** into this folder, using the same simple naming convention as Batch 001:

- `Gen_001.webp` and `Gen_002.webp` correspond to Batch 002 article 1 (hero and inline).
- `Gen_003.webp` and `Gen_004.webp` correspond to Batch 002 article 2.
- `Gen_199.webp` and `Gen_200.webp` correspond to Batch 002 article 100.

**Important:** Batch 001 uses `Images/Gen_001.webp` … `Images/Gen_200.webp`; Batch 002 uses `Images/Batch-002/Gen_001.webp` … `Images/Batch-002/Gen_200.webp`. The pair **folder + filename** determines the article, so the same simple names can safely be reused.

All 200 Batch 002 prompts contain the literal `tripcaution.com` watermark instruction. Inspect the final pictures to verify the watermark is spelled exactly and not distorted: AI image generators may not reproduce text reliably. Keep it near the bottom-center inside a crop-safe margin.

Follow `content/batch-002/image-manifest.csv` for role, article title, exact prompt, caption, alt text and R2 key. Uploading files to GitHub **does not automatically upload them to R2**. Start the separate, manually triggered Batch 002 workflow after all 200 files are present. It validates all files and refuses to overwrite R2 keys with different or unknown content.

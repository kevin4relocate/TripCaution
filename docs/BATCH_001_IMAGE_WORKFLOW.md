# Batch 001 — GitHub to Cloudflare R2

1. Merge the content PR. Upload 200 **real WebP** files into root `Images/` folder on main, named `Gen_001.webp` through `Gen_200.webp`. Files must each be at most 5 MB. Do not merely rename PNG/JPEG extensions.
2. Run GitHub Actions: **TripCaution batch 001 — upload images to R2**, mode `preview`. It validates all 200 files, image signatures, image sizes, manifest ordering, unique names and prints the rename map. No production changes.
3. Create a bucket-scoped R2 S3 API token allowing read/write access to `tripcaution-media`. Set GitHub Actions encrypted secrets `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_ACCOUNT_ID`. Never commit them.
4. Run the workflow again with mode `upload`, confirmation `UPLOAD`. It transfers images into R2 at `editorial/<slug>.webp` for hero and `editorial/<slug>-inline-01.webp` for inline images. It verifies uploaded hashes, refuses overwrites and can skip identical prior uploads when retried.
5. After a successful upload it renames the original files in an isolated GitHub branch `media/batch-001-processed`, not `main`, to avoid accidentally triggering a production deployment. Check this branch; do not blindly merge binary assets to main.

**Important**: This does not import, approve, publish or schedule articles. The draft articles require source verification and deduplication against the live D1 database before any publication. The requested captions and alt text live in `content/batch-001/image-manifest.csv`. The existing public renderer already supports hero captions and inline alt, but displaying per-image caption as structured `figcaption` requires a separate rendering enhancement.

**Retry note**: On a fully successful upload, the `media/batch-001-processed` branch exists. A subsequent upload re-run must not try to replace that branch without first checking it. Failed partial uploads may be resumed safely because existing same-hash objects are skipped.

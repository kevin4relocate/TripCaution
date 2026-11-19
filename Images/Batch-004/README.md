# TripCaution Batch 004 image upload

Place exactly 200 WebP images here, named `Gen_001.webp` through `Gen_200.webp` in numerical order. Odd = hero; even = inline. The 200-image mapping is in `content/batch-004/image-manifest.csv`.

Do **not** rename images before the upload workflow. Do **not** use Batch 003's folder or workflow. After all files are committed to `main`, use GitHub Actions → **TripCaution batch 004 — upload images to R2** → preview, then upload with confirmation `UPLOAD`. The workflow validates real WebP headers and checks hash against any preexisting R2 object without overwriting a different object. It renames GitHub image copies only in the separate processed-media branch.

Daily publication is already scheduled and will refuse to publish an article until both corresponding R2 WebP objects are accessible. These files do not exist yet.

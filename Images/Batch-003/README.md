# TripCaution — Batch 003 image uploads

This is a **separate** GitHub folder for Batch 003. Put **200 genuine WebP images** here, named exactly `Gen_001.webp` to `Gen_200.webp`.

- Odd images = article hero / thumbnail.
- Even images = matching article inline image.
- Article #1 uses `Gen_001.webp` + `Gen_002.webp`; article #100 uses `Gen_199.webp` + `Gen_200.webp`.
- Input names restart for **every** batch. The full folder path disambiguates them. Batch 001 stays in `Images/`; Batch 002 stays in `Images/Batch-002/`.
- Each generated image should show the **exact lowercase** watermark `tripcaution.com` near its bottom-center paper margin; visually inspect the spelling. AI image generation can distort text.

Use `content/batch-003/image-manifest.csv` to produce the images and find captions, alt text, SEO output filenames, R2 keys and prompts.

The separate GitHub Action **TripCaution batch 003 — upload images to R2** supports `preview` first, then explicitly confirmed `upload`. GitHub pushes alone do **not** trigger an R2 upload.

The action uses the same encrypted GitHub R2 credentials as prior batches. It uploads to the existing `tripcaution-media` bucket, `editorial/` prefix and refuses to overwrite nonidentical objects. Renamed GitHub files are staged on branch `media/batch-003-processed` after upload succeeds, not on main.

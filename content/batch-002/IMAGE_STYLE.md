# Batch 002 reference-style and watermark policy

Every image uses this exact core art direction:

> Moody editorial travel-safety illustration in the TripCaution reference style: semi-realistic hand-painted gouache and ink-wash with charcoal outlines, matte pigments and distressed off-white paper texture. Cinematic slate-blue, charcoal and midnight-navy shadows, muted brick-red accents and warm amber highlights; a dark central illustrated scene with irregular painted edges and angular navy/red chevrons across the paper margins. Believable stylized adult figures, expressive but restrained gestures; not a photo, 3D, anime or flat vector.

Add the deliberate lower-margin branding instruction:

> Place exactly one clearly readable `tripcaution.com` watermark in lowercase dark-navy editorial lettering at the lower-center off-white paper margin, inset so a moderate crop will not cut it off. Keep all other text absent.

Hero prompts show a wider situational decision; inline prompts show a closer practical verification. A dark navy / cool-gray gouache-and-ink palette, muted red caution chevrons, hand-painted figures and paper texture must be consistent across the full batch.

The text is embedded in every **one of the 200 self-contained prompts**; do not depend on this file being appended by the image tool.

**Rendering caveat:** Generative image systems sometimes misspell text. The generated watermark must be visually checked before upload. If necessary, a deterministic postprocessing overlay would provide a more reliable exact watermark than AI typography.

Image identifiers restart at `Gen_001` **within each batch folder**, not globally. Captions and alt text explain the pictured subject but must be checked against the final rendered output.

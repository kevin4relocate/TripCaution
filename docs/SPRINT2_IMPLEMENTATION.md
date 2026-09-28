# Sprint 2 — Content, SEO & User Experience

**Implementation status:** code and automated tests implemented. A GitHub-hosted production smoke is used to verify deployment where possible. No database schema change, new advertising/analytics service or owner credential is required by Sprint 2.

## Delivered in source

| Area | Behavior |
|---|---|
| Reading UX | Every Markdown H2/H3 receives a unique, HTML-safe anchor. A keyboard-accessible **In this guide** table of contents appears when an article has at least two headings. It opens on desktops and defaults to collapsed on phones unless the visitor explicitly chooses otherwise. The global Skip to main content link supports keyboard readers. |
| Honest sidebar | **THE QUICK TAKE** appears only when an editor writes a Markdown `## Key takeaways` heading with **2–5 bullet points**. Nothing is summarized automatically or mislabeled as editor-verified. Without the section, the sidebar displays neutral further-reading guidance. |
| Internal linking | Public articles automatically recommend up to three **already published** related guides from the same country or topic category, prioritizing the same country. Draft, hidden, deleted and not-yet-published scheduled articles are excluded by the SQL query. |
| Share/SEO metadata | Live article pages use `og:type=article`, relevant published/modified timestamps, Twitter card metadata and a safe Article + BreadcrumbList JSON-LD graph. JSON serialization prevents editor text from breaking into HTML. The private preview has **no** public structured article data and no canonical tag. |
| SVG social-image limitations | Many social platforms do not reliably preview SVG. The system only emits Open Graph image tags and a large-image Twitter card for genuine HTTPS raster images; existing SVG illustrations continue to display on the website. Creating original licensed/self-produced raster social cards remains an editorial task. |
| Sitemap | Only currently published articles and their published destination landing pages are listed. Real `updated_at`/published timestamps are used for article `lastmod`. Privacy is included; Contact is listed **only when the real inbox is verified**. Static pages have no fabricated lastmod date. |
| Search behavior | The site no longer redirects users into empty or noindex destination pages when an exact destination has **no published guides**. Unpublished destinations show **Research planned** without a clickable dead-end link. SQL LIKE wildcard characters are escaped, and the currently supported Bangkok city route is linked only when a public Bangkok guide exists. |
| Error handling | Missing guides/destinations and generic HTTP 404/500 pages have noindex and noncacheable responses, preventing them from being mistaken for valid search content. |
| Admin SEO helper | A compact **search-result preview** updates the title, description and URL as the owner edits. This is illustrative—not a Google SERP guarantee. It adds no new publishing checklist, approval block or database migration. |
| Content expansion | Twelve original, country-specific research briefs span airport pickup, transit payments, cultural preparation and time-sensitive planning. The editorial roadmap explains source evidence and fact-checking requirements. Briefs are not fake reviewed articles and **have not been published automatically**. |
| Editorial CI | `npm run audit:content` checks the existing starter package's syntax, duplicates, source URLs, headings and metadata. It warns about SVG sharing and AI research timestamps; it never claims to validate facts or permits automatic publishing. |

## Important owner actions (not part of automated deployment)

1. **Check the three existing live guides against the corrected GitHub starter package.** Deploying code does not overwrite D1 content. Apply the editor-confirmed revision import only after a backed-up database; independently open links and approve the updated drafts.
2. **Write optional genuine takeaways.** In an article's Markdown editor, add:

   ```md
   ## Key takeaways
   - An actionable point you have checked against its linked source.
   - Another accurate, narrowly qualified traveler action.
   ```

   Save and open Preview to confirm the sidebar. Do not leave fabricated generic bullet points in published guides.
3. **Set up social raster artwork and a verified custom domain when ready.** Existing SVG editorial illustrations remain website assets, but do not guarantee social-card previews. After you acquire the domain, update `SITE_URL` and any hardcoded imported article-image origins, then test canonical tags, robots, sitemap and OG images before updating Search Console.
4. **Verify a genuine editorial mailbox before displaying it publicly.** An invented `contact@...` address does not count. After a real send/receive test, configure `EDITORIAL_CONTACT_EMAIL` and `EDITORIAL_CONTACT_VERIFIED=true`. Without verification, Contact remains noindex.
5. **Do not introduce advertising or analytics before policy updates.** A perfect SEO score cannot promise ranking or advertising approval.

## Test and rollout boundaries

- Unit regression suite: `npm test` includes heading/Markdown XSS escaping, manual-only takeaways, article schema, structured-data injection safety, private preview noindex, published-only related-reading conditions, indexed search behavior, sitemap date/Contact gating and unobtrusive CMS preview.
- Content metadata audit: `npm run audit:content`; warnings are **editorial follow-ups**, not automated factual review.
- Production verification: GitHub Actions → `TripCaution production smoke`. Public smoke checks server headers, sitemap, public guide markup, Article/Breadcrumb structured metadata, non-indexable 404 and anonymous/private route separation. It intentionally does not log in or alter production data.
- Mobile Lighthouse performance measurements from Sprint 1 are a **historical baseline**, not evidence of updated Sprint 2 real-device performance. The owner opted to skip additional mobile/performance work.
- This phase does **not** claim that all editorial briefs have been researched, that three starter corrections were imported, or that new Google Search Console indexing or AdSense approval has taken place.

## Next optional increment

When the editorial pipeline consistently produces differentiated reviewed articles, consider owner-approved category hubs with at least several genuine public guides, first-party PNG/JPEG social previews and a transparent article revision history. Do not expose thin landing pages solely to increase indexable URLs.

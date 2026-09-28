export const STATUSES = ['draft','review','scheduled','published','hidden','archived','deleted'];
export const CATEGORIES = ['things-to-avoid','tourist-traps','transport','food','local-laws','etiquette','before-you-go'];
export function slugify(input) {
  return String(input || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,105);
}
export function cleanString(v, max=500) { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
export function normalizeURL(value) {
  if (!value || typeof value !== 'string') return null;
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; }
}
export function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,25).map(s => ({title:cleanString(s?.title,220),publisher:cleanString(s?.publisher,120),
    url:normalizeURL(s?.url),published_at:cleanString(s?.published_at,40)}))
    .filter(s => s.title && s.url);
}
export function normalizeArticle(raw) {
  if (!raw || typeof raw !== 'object') throw Error('Invalid article');
  const title=cleanString(raw.title,160), country=cleanString(raw.country,90),
    slug=slugify(raw.slug || raw.title),
    content=cleanString(raw.content_markdown,100000),
    seo=raw.seo || {}, images=raw.images || {}, research=raw.research || {};
  if (!title || !slug || !country || content.length < 100) throw Error('Title, country and >=100 characters of content are required');
  const category=cleanString(raw.category || raw.category_id,70);
  return {
    id:cleanString(raw.id,80)||crypto.randomUUID(),title,slug,country,
    city:cleanString(raw.city,120)||null,
    excerpt:cleanString(raw.excerpt,480),
    content_markdown:content,category_id:CATEGORIES.includes(category)?category:'before-you-go',
    tags_json:JSON.stringify(Array.isArray(raw.tags)?raw.tags.slice(0,16).map(x=>cleanString(x,50)):[]),
    sources_json:JSON.stringify(normalizeSources(raw.sources || research.sources)),
    uncertainties_json:JSON.stringify(Array.isArray(research.uncertainties)?research.uncertainties.slice(0,20):[]),
    seo_title:cleanString(raw.seo_title || seo.title || title,160),
    seo_description:cleanString(raw.seo_description || seo.description || raw.excerpt,300),
    hero_image_url:normalizeURL(raw.hero_image_url || images.hero_image_url),
    hero_prompt:cleanString(raw.hero_prompt || images.hero_prompt,3000),
    hero_alt:cleanString(raw.hero_alt || images.alt_text,300),
    source_mode:cleanString(raw.source_mode || raw.publishing?.mode,50)||'manual',
    verified_at:cleanString(raw.verified_at || research.verified_at,40)||null,
    scheduled_at:cleanString(raw.scheduled_at,45)||null
  };
}
export function canAutoPublish(a) {
  // No unattended publishing of negative allegations, legal, health, safety, immigration or incidents.
  return ['before-you-go','etiquette'].includes(a.category_id) &&
    JSON.parse(a.sources_json).length >= 2 &&
    Boolean(a.verified_at);
}
export function isValidSchedule(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
    /(?:Z|[+-]\d\d:\d\d)$/.test(value);
}

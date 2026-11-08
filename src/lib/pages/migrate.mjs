// Turns a site's existing Home and About pages into block pages, so switching to the page editor
// loses nothing. Used by Chapbook the first time a writer opens Home or About in the page editor;
// nothing is saved until they press Save.
import { professionalDetails } from '../professional.mjs';
import { designDetails, sectionOrder, defaultTitles, infoSitsInOpening, BUSINESS_LAYOUTS, SECTION_LABELS } from '../business/render.mjs';
import { aboutDetails } from '../about.mjs';
import { normalisePage, cleanText } from './schema.mjs';

// How each business design lays out its opening and its price list today.
const HERO = { table: 'centred', trade: 'panel', clinic: 'panel', pulse: 'poster', counsel: 'split', shopfront: 'centred', practice: 'panel', petal: 'centred', contour: 'panel', cut: 'poster', still: 'centred', office: 'split' };
const SERVICES = { table: 'menu', trade: 'cards', clinic: 'table', pulse: 'numbered', counsel: 'numbered', shopfront: 'cards', practice: 'cards', petal: 'menu', contour: 'menu', cut: 'board', still: 'numbered', office: 'numbered' };
const GALLERY = { table: 'masonry', shopfront: 'mosaic', petal: 'masonry', cut: 'strip' };
const CONTACT = { table: 'inline', shopfront: 'inline', pulse: 'band', cut: 'card' };
const BUTTON = { table: 'Book a table', trade: 'Get a quote', clinic: 'Book an appointment', pulse: 'Book a class', counsel: 'Arrange a consultation', shopfront: 'Place an order', practice: 'Book a session', petal: 'Find an appointment', contour: 'Book a consultation', cut: 'Book a chair', still: 'Book a session', office: 'Book a call' };

const pic = (i) => (i && /^\/site-images\//.test(i.src) ? { src: i.src, alt: i.alt || '' } : null);
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)));

export function pageFromHome(site = {}, theme = site.defaultTheme) {
  const raw = site.professional || {};
  const p = professionalDetails(raw);
  const business = BUSINESS_LAYOUTS.includes(theme);
  const design = designDetails(site.design, sectionOrder(theme));
  const titles = defaultTitles(theme);
  const title = (id, own) => own || titles[id] || SECTION_LABELS[id];
  const blocks = [], spare = [];
  if (p.announcement) (design.bannerOn ? blocks : spare).push({ type: 'notice', role: 'notice', variant: 'bar', data: { text: p.announcement } });
  const buttons = [];
  const hasContact = p.bookingUrl || p.email || p.phone;
  if (hasContact) buttons.push({ label: p.bookingUrl ? (raw.bookingLabel || BUTTON[theme] || 'Book now') : 'Get in touch', href: p.bookingUrl ? '@booking' : '/contact/' });
  if (p.paymentUrl) buttons.push({ label: p.paymentLabel || 'Pay online', href: p.paymentUrl });
  const heroVariant = HERO[theme] || (p.heroImage ? 'split' : 'minimal');
  blocks.push({ type: 'hero', role: 'hero', variant: heroVariant, data: strip({
    kicker: p.eyebrow || site.name || '', heading: p.heading || site.masthead || site.name || '', intro: p.intro || site.tagline || '',
    picture: pic(p.heroImage), buttons, details: business && infoSitsInOpening(theme) && heroVariant !== 'panel' ? true : undefined,
  }) });
  for (const s of design.sections) {
    const into = s.on ? blocks : spare;
    if (s.id === 'photos' && p.gallery.length) into.push({ type: 'gallery', role: 'gallery', variant: GALLERY[theme] || 'grid', data: { heading: title('photos', s.title), pictures: p.gallery.map(pic).filter(Boolean) } });
    if (s.id === 'services' && p.services.length) into.push({ type: 'services', role: 'services', variant: SERVICES[theme] || 'menu', data: { heading: title('services', s.title), items: p.services.map((x) => strip({
      name: x.name, description: x.description, price: x.price, duration: x.duration, offer: x.offer, picture: pic(x.image),
      link: x.bookingUrl ? { label: 'Book', href: x.bookingUrl } : null,
      pay: x.paymentUrl ? { label: x.payLabel || 'Pay now', href: promoHref(x) } : null,
    })) } });
    if (s.id === 'story' && p.story) into.push({ type: 'text', role: 'story', variant: ['counsel', 'office', 'practice'].includes(theme) ? 'sidehead' : 'plain', data: { heading: s.title || p.storyTitle || titles.story || 'Our story', body: p.story } });
    if (s.id === 'info' && (p.hours || p.location || p.phone || p.email) && !(business && infoSitsInOpening(theme))) into.push({ type: 'contact', role: 'contact', variant: CONTACT[theme] || 'split', data: { heading: s.title || 'Find us', business: true } });
    if (s.id === 'trust' && p.credentials.length) into.push({ type: 'credentials', role: 'credentials', variant: theme === 'trade' ? 'badges' : 'list', data: strip({ heading: s.title || titles.trust || '', items: p.credentials.map((text) => ({ text })) }) });
    if (s.id === 'about') into.push({ type: 'cta', role: 'about-link', variant: 'minimal', data: { heading: title('about', s.title), buttons: [{ label: 'Read more', href: '/about/' }] } });
    if (s.id === 'news') into.push({ type: 'posts', role: 'posts', variant: 'list', data: { heading: title('news', s.title) || 'News', count: 3 } });
  }
  return normalisePage({ v: 1, title: 'Home', slug: 'home', menu: { show: true, label: 'Home' }, blocks, spare });
}
function promoHref(x) {
  if (!x.promoCode) return x.paymentUrl;
  try { const u = new URL(x.paymentUrl); if (u.hostname === 'buy.stripe.com') u.searchParams.set('prefilled_promo_code', x.promoCode); return u.href; } catch { return x.paymentUrl; }
}

// About: the profile (name, role, bio, numbers) plus any lists the site already shows.
const LISTS = [['experience', 'Experience'], ['qualifications', 'Qualifications'], ['publications', 'Publications'], ['conferences', 'Talks and conferences'], ['awards', 'Awards'], ['audits', 'Audits'], ['teaching', 'Teaching']];
const entryLine = (e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? Object.values(e).filter((v) => typeof v === 'string' && v.trim()).join(', ') : '');
export function pageFromAbout(profile = {}, site = {}, lists = {}) {
  const a = aboutDetails(profile, site, professionalDetails(site.professional || {}));
  const blocks = [];
  blocks.push({ type: 'hero', role: 'hero', variant: 'minimal', data: strip({ kicker: a.role, heading: a.name || 'About', intro: a.tagline }) });
  if (a.bio.length) blocks.push({ type: 'text', role: 'story', variant: 'lede', data: { body: a.bio.join('\n\n') } });
  if (a.stats.length) blocks.push({ type: 'facts', role: 'facts', variant: 'row', data: { items: a.stats.slice(0, 6).map((s) => ({ value: `${s.value}${s.suffix || ''}`, label: s.label })) } });
  if (a.highlights.length) blocks.push({ type: 'credentials', role: 'credentials', variant: 'list', data: { heading: 'Highlights', items: a.highlights.map((text) => ({ text })) } });
  const memberships = (Array.isArray(profile.memberships) ? profile.memberships : []).map(entryLine).filter(Boolean);
  if (memberships.length) blocks.push({ type: 'credentials', role: 'memberships', variant: 'badges', data: { heading: 'Memberships', items: memberships.slice(0, 16).map((text) => ({ text })) } });
  for (const [key, heading] of LISTS) {
    const lines = (Array.isArray(lists[key]) ? lists[key] : []).map(entryLine).filter(Boolean);
    if (lines.length) blocks.push({ type: 'text', role: key, variant: 'sidehead', data: { heading, body: cleanText(lines.map((l) => `- ${l.replace(/\n+/g, ' ')}`).join('\n'), 6000) } });
  }
  return normalisePage({ v: 1, title: 'About', slug: 'about', menu: { show: true, label: 'About' }, blocks });
}

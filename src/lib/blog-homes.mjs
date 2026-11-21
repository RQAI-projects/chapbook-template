// Which home page each look draws. Every look's `hero` archetype (src/data/themes.json) names one
// of the components in src/components/home/; the business and personal looks share
// HomeBusiness, which a page built in Chapbook's editor replaces.
//
// A website wears one look, so only that look's home component is built in (astro.config.mjs
// serves it as `virtual:chapbook-home`). Each blog home brings its own styles, about 20 KB
// gzipped for all of them together; a business home page used to wait for every one.
export const HOME_FILES = {
  folio: 'HomeFolio', portrait: 'HomePortrait',
  practice: 'HomeBusiness', petal: 'HomeBusiness', contour: 'HomeBusiness', cut: 'HomeBusiness', still: 'HomeBusiness', office: 'HomeBusiness',
  table: 'HomeBusiness', trade: 'HomeBusiness', clinic: 'HomeBusiness', pulse: 'HomeBusiness', counsel: 'HomeBusiness', shopfront: 'HomeBusiness',
  rings: 'HomeRings', index: 'HomeIndex', solo: 'HomeSolo', 'blueprint-board': 'HomeBlueprintBoard', frontpage: 'HomeFrontPage',
  'essay-cover': 'HomeEssayCover', 'news-wall': 'HomeNewsWall', 'desert-scroll': 'HomeDesertArchive', marquee: 'HomeMarquee',
  collage: 'HomeCollage', pinboard: 'HomePinboard', 'woodland-trail': 'HomeWoodlandChronicle', notebook: 'HomeNotebook',
  'mission-control': 'HomeMissionControl', 'pixel-quest': 'HomePixelQuest', manga: 'HomeManga', 'field-atlas': 'HomeFieldAtlas',
  lightbox: 'HomeLightbox', 'contact-sheet': 'HomeContactSheet', 'photo-pile': 'HomePhotoPile',
};
// The home component for a look (as Base.astro resolves the look: Observatory when none is set).
// An unknown look, or one with no archetype, draws the rings, as before.
export function homeFileFor(themeId, registry) {
  const id = themeId || 'observatory';
  const entry = (registry?.themes || []).find((t) => t.id === id);
  return HOME_FILES[entry?.hero || 'rings'] || 'HomeRings';
}

// Per-theme VOCABULARY. Each theme in src/data/themes.json may carry a `vocabulary`
// block giving it its own words: postsTitle (the writing archive's name), topicsLabel
// (the noun for the topic set — the per-theme replacement for "constellations"),
// aboutLabel, an optional demo tagline, and topicNames (a DISPLAY-NAME override map
// over the seed topic SLUGS in topics.json). Missing keys fall back to the house
// defaults below, so a theme that omits `vocabulary` is unchanged. Slugs/URLs never
// change — topicNames only relabels; unknown/user-created topics pass through.
import themes from '../data/themes.json';

export interface Vocab {
  postsTitle: string;
  topicsLabel: string;
  aboutLabel: string;
  /** optional themed demo tagline (used only when the site tagline is the seed default). */
  tagline?: string;
  topicNames: Record<string, string>;
}

const DEFAULT_VOCAB: Vocab = {
  postsTitle: 'Posts',
  topicsLabel: 'Topics',
  aboutLabel: 'About',
  topicNames: {},
};

/** Merged vocabulary for a theme id (theme's block over the house defaults). */
export function vocabFor(themeId: string | undefined | null): Vocab {
  const v = (themes.themes.find((t) => t.id === themeId) as any)?.vocabulary || {};
  return {
    postsTitle: v.postsTitle ?? DEFAULT_VOCAB.postsTitle,
    topicsLabel: v.topicsLabel ?? DEFAULT_VOCAB.topicsLabel,
    aboutLabel: v.aboutLabel ?? DEFAULT_VOCAB.aboutLabel,
    tagline: v.tagline,
    topicNames: { ...(v.topicNames || {}) },
  };
}

/** Theme display name for a topic slug: theme override → provided fallback (seed name). */
export function topicName(vocab: Vocab, slug: string, fallback: string): string {
  return vocab.topicNames[slug] || fallback;
}

/** The seed placeholder tagline in the template's site.json. When the user still has
 *  this (i.e. hasn't written their own), the catalogue shows the theme's demo tagline
 *  so each preview reads in-voice; a real user's tagline always wins. */
export const SEED_TAGLINE = 'A line about your blog.';

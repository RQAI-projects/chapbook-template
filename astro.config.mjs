import { defineConfig } from 'astro/config';
import rehypeGallery from './src/lib/rehype-gallery.mjs';
import remarkBasePath from './src/plugins/remark-base-path.mjs';
import siteConfig from './src/data/site.json';

// A website wears one look (site.json defaultTheme), and every look's rules are scoped to its own
// [data-blog-theme], so the other looks' stylesheets can never apply. themes.css lists all of
// them; only the website's own look (and the shared parts) are kept in the build, which takes
// about three quarters off the stylesheet every page waits for. Chapbook's editor reads
// themes.css itself and keeps every look.
const ownLook = siteConfig.defaultTheme || 'observatory';
function oneLook() {
  return {
    name: 'chapbook-one-look',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].replace(/\\/g, '/').endsWith('/src/styles/themes.css')) return null;
      return { code: code.replace(/@import\s+['"]\.\/themes\/([a-z0-9-]+)\.css['"];/gi, (m, name) => (name === ownLook ? m : '')), map: null };
    },
  };
}

export default defineConfig({
  vite: { plugins: [oneLook()] },
  site: siteConfig.url,
  // Serve at a GitHub Pages project sub-path when BASE_PATH is set
  // (e.g. BASE_PATH=/repo/). Unset → '/' → the owner's root-domain site,
  // byte-for-byte unchanged. Astro auto-prefixes its own _astro/ assets.
  base: process.env.BASE_PATH || '/',
  compressHTML: true,
  markdown: {
    remarkPlugins: [remarkBasePath],
    rehypePlugins: [rehypeGallery],
  },
});

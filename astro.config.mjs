import { defineConfig } from 'astro/config';
import rehypeGallery from './src/lib/rehype-gallery.mjs';
import remarkBasePath from './src/plugins/remark-base-path.mjs';
import siteConfig from './src/data/site.json';
import themeRegistry from './src/data/themes.json';
import { fileURLToPath } from 'node:url';
import { homeFileFor } from './src/lib/blog-homes.mjs';
import pageCss from './src/lib/page-css.mjs';

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

// The same for the home page: index.astro imports `virtual:chapbook-home`, which is only the
// website's own look's home component (src/lib/blog-homes.mjs). Each blog home's styles are
// bundled with it, so a business home page no longer waits for the thirty blog homes' styles.
function oneHome() {
  const id = 'virtual:chapbook-home', resolved = '\0' + id;
  const file = fileURLToPath(new URL(`./src/components/home/${homeFileFor(ownLook, themeRegistry)}.astro`, import.meta.url));
  return {
    name: 'chapbook-one-home',
    resolveId(source) { return source === id ? resolved : null; },
    load(source) { return source === resolved ? `export { default } from ${JSON.stringify(file)};` : null; },
  };
}

// GSAP, and the blog looks' movement that uses it (src/components/BlogMotion.astro), are bundled on
// their own, so a page made in the page editor can leave them out (src/lib/page-css.mjs).
const blogMotion = (id) => (/\/node_modules\/gsap\//.test(id) || /\/src\/components\/BlogMotion\.astro\?astro&type=script/.test(id) ? 'blog-motion' : undefined);

export default defineConfig({
  vite: { plugins: [oneLook(), oneHome()], build: { rollupOptions: { output: { manualChunks: blogMotion } } } },
  // After the build, each block page keeps only the styles it can use, in its own head
  // (src/lib/page-css.mjs); blog pages are left exactly as built.
  integrations: [pageCss()],
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

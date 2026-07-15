// Static per-post OG card endpoint → dist/og/<slug>.png at build time.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../lib/og';
import topics from '../../data/topics.json';

export async function getStaticPaths() {
  // Opt-in QA speedup: skip the (slow) satori/resvg OG-card render when QA_SKIP_OG is
  // set, so the theme screenshot loop rebuilds fast. Off by default → real builds are
  // unchanged and every post still gets its share card.
  if (process.env.QA_SKIP_OG) return [];
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.slug }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const post = (props as any).post;
  const broad = new Map((topics as any[]).map((t) => [t.tag, t]));
  const topicTag = (post.data.tags || []).find((t: string) => broad.has(t));
  const t = topicTag ? broad.get(topicTag) : null;
  const png = await renderOgCard({ title: post.data.title, topic: t?.name, color: t?.color });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};

// What the public About page shows. Starter placeholders and empty values stay absent, so a
// new site never publishes "Your Name" or invented details.
const PLACEHOLDERS=new Set(['Your Name','What you do','A short line about you and this blog.','you@example.com','A short paragraph about who you are and what this blog is for.','A second paragraph if you want one — what you write about, and why.','Something worth counting']);
const real=v=>{const s=typeof v==='string'?v.trim():'';return PLACEHOLDERS.has(s)?'':s;};
export function aboutDetails(profile={},site={},professional={}){
 const p=profile&&typeof profile==='object'?profile:{};
 const bio=(Array.isArray(p.bio)?p.bio:[]).map(real).filter(Boolean);
 const intro=real(professional.intro);
 return {
  name:real(p.name)||real(p.title)||real(site.name),
  credentials:real(p.credentials),
  role:[real(p.role)||real(professional.eyebrow),real(p.trust)].filter(Boolean).join(' · '),
  tagline:real(p.tagline),
  bio:bio.length?bio:intro?[intro]:[],
  stats:(Array.isArray(p.stats)?p.stats:[]).filter(s=>s&&real(s.label)&&Number(s.value)>0),
  highlights:(Array.isArray(professional.credentials)?professional.credentials:[]).map(real).filter(Boolean),
 };
}

// Every business home page is produced here, from plain data. The same code runs in the site
// build and in Chapbook's live preview, so what a writer sees is what gets published.
// All values are escaped; empty details stay hidden; nothing is invented.
import {professionalDetails,contactHref,telHref,bookingText,paymentHref} from '../professional.mjs';

export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HEX=/^#[0-9a-fA-F]{6}$/;
export const SECTION_LABELS={banner:'Announcement bar',hero:'Opening',photos:'Photo gallery',services:'Services and prices',story:'Your story',info:'Hours and location',trust:'Qualifications and memberships',about:'Link to About page',news:'Latest posts'};
const ORDER=['banner','hero','photos','services','story','info','trust','about','news'];
export const FIXED_SECTIONS=['banner','hero'];
export const FONTS={classic:"Georgia,'Times New Roman',serif",modern:"'Fraunces',Georgia,serif",editorial:"'Newsreader',Georgia,serif",clean:"'Inter Variable',system-ui,sans-serif",friendly:"'Fredoka','Inter Variable',sans-serif"};
export const CORNERS={square:'0',soft:'8px',round:'20px'};

// Colours, heading font, corners and section order. Anything unknown is dropped.
export function designDetails(value,order=ORDER){
 const d=value&&typeof value==='object'?value:{};
 const color=k=>typeof d[k]==='string'&&HEX.test(d[k])?d[k]:'';
 const own=(o,k)=>typeof k==='string'&&Object.hasOwn(o,k);
 const known=new Set();
 const given=(Array.isArray(d.sections)?d.sections:[]).filter(s=>s&&ORDER.includes(s.id)&&!known.has(s.id)&&known.add(s.id)).map(s=>({id:s.id,on:s.on!==false,title:typeof s.title==='string'?s.title.trim().slice(0,100):''}));
 const sections=given.filter(s=>!FIXED_SECTIONS.includes(s.id));
 for(const id of order)if(!FIXED_SECTIONS.includes(id)&&!known.has(id))sections.push({id,on:true,title:''});
 const hero=given.find(s=>s.id==='banner');
 return {accent:color('accent'),background:color('background'),ink:color('ink'),font:own(FONTS,d.font)?d.font:'',corners:own(CORNERS,d.corners)?d.corners:'',bannerOn:hero?hero.on:true,sections};
}
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
// Text on a button stays readable whatever colour the writer picks.
export const readableOn=hex=>{for(const c of ['#ffffff','#16181d'])if(ratio(hex,c)>=4.5)return c;return ratio(hex,'#000000')>=ratio(hex,'#ffffff')?'#000000':'#ffffff';};
export const contrast=ratio;
// Site-wide CSS for the writer's choices. Values are validated above, so this is safe to inline.
// `theme` holds the theme's own colours, so a partly changed palette still stays readable.
// The doubled attribute outranks the theme's stylesheet wherever this sits in the page.
export function effectiveColours(value,theme={}){
 const d=designDetails(value);
 const background=d.background||theme.bg||'#ffffff',accent=d.accent||theme.accent||'#333333';
 let ink=d.ink||theme.ink||'#16181d';
 if(!d.ink&&d.background&&ratio(ink,background)<4.5)ink=readableOn(background);
 // Softer secondary text, unless softening would make it hard to read.
 const mixed='#'+[1,3,5].map(i=>Math.round(parseInt(ink.slice(i,i+2),16)*.8+parseInt(background.slice(i,i+2),16)*.2).toString(16).padStart(2,'0')).join('');
 return {background,accent,ink,dim:ratio(mixed,background)>=4.5?mixed:ink,accentText:ratio(accent,background)>=4.5?accent:readableOn(background)};
}
export function designCss(value,theme={}){
 const d=designDetails(value);const v=[];
 const colourChanged=d.accent||d.background||d.ink;
 if(colourChanged){
  const c=effectiveColours(value,theme);
  v.push(`--accent-text:${c.accentText}`);
  if(d.accent)v.push(`--accent:${d.accent}`,`--teal:${d.accent}`,`--cyan:${d.accent}`,`--violet:${d.accent}`,`--pro-button-ink:${readableOn(d.accent)}`);
  if(d.background){const tone=lum(c.background)<.2?'#ffffff':'#000000';v.push(`--bg-0:${d.background}`,`--bg-1:${d.background}`,`--bg-2:${d.background}`,`--bg-3:color-mix(in srgb,${d.background} 93%,${tone})`,`--header-bg:${d.background}`,`--pro-card:${d.background}`);}
  if(d.ink||d.background)v.push(`--ink:${c.ink}`,`--masthead-ink:${c.ink}`,`--ink-dim:${c.dim}`,`--ink-faint:${c.dim}`,`--line:color-mix(in srgb,${c.ink} 14%,transparent)`,`--line-strong:color-mix(in srgb,${c.ink} 30%,transparent)`,`color-scheme:${lum(c.background)<.2?'dark':'light'}`);
 }
 if(d.corners)v.push(`--radius:${CORNERS[d.corners]}`,`--pro-corner:${CORNERS[d.corners]}`);
 let css=v.length?`html[data-blog-theme][data-blog-theme]{${v.join(';')}}`:'';
 if(d.font)css+=`.pro-site h1,.pro-site h2,.pro-site h3{font-family:${FONTS[d.font]}!important}`;
 return css;
}

const img=(i,cls,lazy=true)=>i?`<img class="${cls}" src="${esc(i.src)}" alt="${esc(i.alt)}"${lazy?' loading="lazy"':''}>`:'';
const svcPhoto=s=>img(s.image,'pro-service-photo');
const lines=c=>c.map(x=>`<p>${esc(x)}</p>`).join('');
const items=c=>c.map(x=>`<li>${esc(x)}</li>`).join('');
const num=i=>String(i+1).padStart(2,'0');
// Offer wording, promotion code and the pay button, shared by every layout.
export function serviceExtras(s){
 const pay=paymentHref(s);
 return (s.offer?`<p class="pro-offer">${esc(s.offer)}${s.promoCode?` <span>Code ${esc(s.promoCode)}</span>`:''}</p>`:'')
  +(pay?`<p class="pro-pay-row"><a class="pro-button pro-pay" href="${esc(pay)}">${esc(s.payLabel||'Pay now')}</a></p>`:'');
}
export function serviceMenuHtml(services){
 return services.length?`<div class="service-menu">${services.map((s,i)=>`<article><span class="pro-number">${num(i)}</span><div>${svcPhoto(s)}<h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${s.duration?`<small>${esc(s.duration)}</small>`:''}${s.bookingUrl?`<p><a class="pro-link" href="${esc(s.bookingUrl)}">Book ${esc(s.name)} ↗</a></p>`:''}${serviceExtras(s)}</div>${s.price?`<span class="pro-price">${esc(s.price)}</span>`:''}</article>`).join('')}</div>`:'';
}
const heroPhoto=c=>c.p.heroImage?`<figure class="pro-hero-photo">${img(c.p.heroImage,'',false)}</figure>`:'';
const button=(c,text,cls='pro-button')=>c.cta?`<a class="${cls}" href="${esc(c.cta)}">${esc(text)}</a>`:'';
const payAll=c=>c.p.paymentUrl?`<a class="pro-button pro-pay" href="${esc(c.p.paymentUrl)}">${esc(c.p.paymentLabel||'Pay online')}</a>`:'';
const actions=(c,text,cls)=>{const a=button(c,text,cls),b=payAll(c);return a||b?`<div class="pro-actions">${a}${b}</div>`:'';};
const head=c=>`<p class="pro-kicker">${esc(c.p.eyebrow||c.name)}</p><h1>${esc(c.p.heading||c.masthead)}</h1><p class="pro-intro">${esc(c.p.intro||c.tagline)}</p>`;
const infoOn=c=>c.on('info');
const ct=x=>x?`<h2 class="pro-custom-title">${esc(x)}</h2>`:'';
const contactLines=c=>`${c.tel?`<p><a href="${esc(c.tel)}">${esc(c.p.phone)}</a></p>`:''}${c.p.email?`<p><a href="mailto:${esc(encodeURIComponent(c.p.email))}">${esc(c.p.email)}</a></p>`:''}`;
const wants=(c,text)=>c.p.bookingUrl?bookingText(c.raw,text):null;

// One composition per business theme. `info` left out means it sits inside that theme's opening.
const L={
 table:{cls:'table-site',t:{photos:'A look inside',services:'The menu',story:'Our story',about:'Our story',trust:'',news:'News'},
  hero:c=>`<header class="table-sign">${head(c)}${actions(c,wants(c,'Book a table')||'Get in touch')}</header>${heroPhoto(c)}`,
  info:(c,_t,custom)=>{const p=c.p,tel=c.tel;return p.hours||p.location||tel||p.email?`${ct(custom)}<dl class="table-facts">${p.hours?`<div><dt>Open</dt><dd class="pro-hours">${esc(p.hours)}</dd></div>`:''}${p.location?`<div><dt>Find us</dt><dd>${esc(p.location)}</dd></div>`:''}${tel?`<div><dt>Call</dt><dd><a href="${esc(tel)}">${esc(p.phone)}</a></dd></div>`:''}${p.email?`<div><dt>Email</dt><dd><a href="mailto:${esc(encodeURIComponent(p.email))}">${esc(p.email)}</a></dd></div>`:''}</dl>`:''},
  services:(c,t)=>`<section class="table-menu"><h2>${esc(t)}</h2><div>${c.p.services.map(s=>`<article>${svcPhoto(s)}<h3><span>${esc(s.name)}</span>${s.price?`<i aria-hidden="true"></i><b>${esc(s.price)}</b>`:''}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${s.duration?`<small>${esc(s.duration)}</small>`:''}${serviceExtras(s)}</article>`).join('')}</div></section>`,
  trust:(c,_t,custom)=>`${ct(custom)}<ul class="table-notes">${items(c.p.credentials)}</ul>`,about:(c,t)=>`<p class="table-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 trade:{cls:'trade-site',t:{photos:'Recent work',services:'What we do',story:'About the business',about:'About us',trust:'',news:'News'},infoInHero:true,
  hero:c=>{const p=c.p,tel=c.tel,a=tel?`<a class="pro-button trade-call" href="${esc(tel)}">Call ${esc(p.phone)}</a>`:'',b=c.cta&&c.cta!==tel?`<a class="${tel?'pro-link':'pro-button'}" href="${esc(c.cta)}">${esc(wants(c,'Get a quote')||'Get a quote')}</a>`:'';return `<div class="trade-opening"><div>${head(c)}<div class="trade-actions">${a}${b}${payAll(c)}</div></div>${infoOn(c)&&(p.hours||p.location||p.email)?`<aside class="trade-when">${p.hours?`<h2>When we work</h2><p class="pro-hours">${esc(p.hours)}</p>`:''}${p.location?`<h2>Where we work</h2><p>${esc(p.location)}</p>`:''}${p.email?`<h2>Email</h2><p><a href="mailto:${esc(encodeURIComponent(p.email))}">${esc(p.email)}</a></p>`:''}</aside>`:''}</div>${heroPhoto(c)}`},
  trust:(c,_t,custom)=>`${ct(custom)}<ul class="trade-badges" aria-label="Accreditations">${items(c.p.credentials)}</ul>`,
  services:(c,t)=>`<section class="trade-work"><h2>${esc(t)}</h2><div>${c.p.services.map(s=>{const m=[s.price,s.duration].filter(Boolean).join(' · ');return `<article>${svcPhoto(s)}<h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${m?`<small>${esc(m)}</small>`:''}${s.bookingUrl?`<a class="pro-link" href="${esc(s.bookingUrl)}">Ask about this ↗</a>`:''}${serviceExtras(s)}</article>`}).join('')}</div></section>`,
  about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 clinic:{cls:'clinic-site',t:{photos:'Inside the clinic',services:'Treatments and fees',story:'About the clinic',about:'Meet the team',trust:'Registrations',news:'News'},infoInHero:true,
  hero:c=>{const p=c.p,details=infoOn(c)?`${p.hours?`<p class="pro-hours">${esc(p.hours)}</p>`:''}${p.location?`<p>${esc(p.location)}</p>`:''}${contactLines(c)}`:'',act=`${button(c,wants(c,'Book an appointment')||'Get in touch')}${payAll(c)}`;return `<div class="clinic-opening"><div>${head(c)}</div>${details||act?`<aside class="clinic-panel"><h2>Appointments</h2>${details}${act}</aside>`:''}</div>${heroPhoto(c)}`},
  services:(c,t)=>`<section class="clinic-fees"><h2>${esc(t)}</h2><div role="list">${c.p.services.map(s=>`<article role="listitem"><div>${svcPhoto(s)}<h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${serviceExtras(s)}</div><span>${esc(s.duration)}</span><b>${esc(s.price)}</b></article>`).join('')}</div></section>`,
  trust:(c,t)=>`<section class="clinic-trust"><h2>${esc(t)}</h2><ul>${items(c.p.credentials)}</ul></section>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 pulse:{cls:'pulse-site',pair:['info','trust','pro-pair'],t:{photos:'In the studio',services:'Classes',story:'About the studio',about:'About the studio',trust:'Your coaches',news:'News'},
  hero:c=>`<div class="pulse-opening"><p class="pro-kicker">${esc(c.p.eyebrow||c.name)}</p><h1>${esc(c.p.heading||c.masthead)}</h1><div class="pulse-lead"><p class="pro-intro">${esc(c.p.intro||c.tagline)}</p>${actions(c,wants(c,'Book a class')||'Get in touch')}</div></div>${heroPhoto(c)}`,
  services:(c,t)=>`<section class="pulse-classes"><h2>${esc(t)}</h2><div>${c.p.services.map(s=>`<article><span class="pulse-time">${esc(s.duration)}</span><div>${svcPhoto(s)}<h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${serviceExtras(s)}</div><b>${esc(s.price)}</b>${s.bookingUrl?`<a class="pro-link" href="${esc(s.bookingUrl)}">Book ↗</a>`:'<span></span>'}</article>`).join('')}</div></section>`,
  info:(c,_t,custom)=>{const p=c.p;return p.hours||p.location||p.phone||p.email?`<section class="pulse-info">${custom?`<div>${ct(custom)}</div>`:''}${p.hours?`<div><h2>Open</h2><p class="pro-hours">${esc(p.hours)}</p></div>`:''}${p.location?`<div><h2>Find us</h2><p>${esc(p.location)}</p></div>`:''}${p.phone||p.email?`<div><h2>Get in touch</h2>${contactLines(c)}</div>`:''}</section>`:''},
  trust:(c,t)=>`<section class="pulse-info"><div><h2>${esc(t)}</h2>${lines(c.p.credentials)}</div></section>`,about:(c,t)=>`<p class="pulse-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 counsel:{cls:'counsel-site',pair:['trust','info','pro-pair'],t:{photos:'Our offices',services:'Areas of expertise',story:'About the firm',about:'About us',trust:'Memberships',news:'Insights'},
  hero:c=>`<div class="counsel-opening">${head(c)}${actions(c,wants(c,'Arrange a consultation')||'Get in touch')}</div>${heroPhoto(c)}`,
  services:(c,t)=>`<section class="counsel-areas"><h2>${esc(t)}</h2><div>${c.p.services.map((s,i)=>`<article>${svcPhoto(s)}<span class="pro-number">${num(i)}</span><h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${s.price?`<small>${esc(s.price)}</small>`:''}${serviceExtras(s)}</article>`).join('')}</div></section>`,
  info:(c,_t,custom)=>{const p=c.p,tel=c.tel;return p.location||p.hours||tel||p.email?`<div class="counsel-foot"><section><h2>${esc(custom||'Contact')}</h2>${p.location?`<p>${esc(p.location)}</p>`:''}${p.hours?`<p class="pro-hours">${esc(p.hours)}</p>`:''}${tel?`<p><a href="${esc(tel)}">${esc(p.phone)}</a></p>`:''}${p.email?`<p><a href="mailto:${esc(encodeURIComponent(p.email))}">${esc(p.email)}</a></p>`:''}</section></div>`:''},
  trust:(c,t)=>`<div class="counsel-foot"><section><h2>${esc(t)}</h2><ul>${items(c.p.credentials)}</ul></section></div>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 shopfront:{cls:'shopfront-site',t:{photos:'In the shop',services:"What you'll find",story:'Our story',about:'Our story',trust:'',news:'News'},
  hero:c=>`<div class="shop-awning" aria-hidden="true"></div><header class="shop-sign">${head(c)}${actions(c,wants(c,'Place an order')||'Get in touch')}</header>${heroPhoto(c)}`,
  info:(c,_t,custom)=>{const p=c.p,tel=c.tel;return p.hours||p.location||tel||p.email?`${ct(custom)}<section class="shop-door">${p.hours?`<div><h2>We're open</h2><p class="pro-hours">${esc(p.hours)}</p></div>`:''}${p.location?`<div><h2>Find the shop</h2><p>${esc(p.location)}</p></div>`:''}${tel||p.email?`<div><h2>Get in touch</h2>${contactLines(c)}</div>`:''}</section>`:''},
  services:(c,t)=>`<section class="shop-shelf"><h2>${esc(t)}</h2><div>${c.p.services.map(s=>`<article>${svcPhoto(s)}<h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}${s.price?`<b>${esc(s.price)}</b>`:''}${s.bookingUrl?`<a class="pro-link" href="${esc(s.bookingUrl)}">Order ↗</a>`:''}${serviceExtras(s)}</article>`).join('')}</div></section>`,
  trust:(c,_t,custom)=>`${ct(custom)}<ul class="shop-notes">${items(c.p.credentials)}</ul>`,about:(c,t)=>`<p class="shop-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 practice:{cls:'practice',t:{photos:'The practice',services:'Areas of practice',story:'A place to begin',about:'Background & qualifications',trust:'',news:'Notes from practice'},infoInHero:true,
  hero:c=>{const p=c.p;return `<section class="practice-opening"><div class="practice-title"><p class="pro-kicker">${esc(p.eyebrow||'Practice & perspective')}</p><h1>${esc(p.heading||c.masthead)}</h1><p class="pro-intro">${esc(p.intro||c.tagline)}</p></div><aside class="practice-contact"><div class="practice-mark" aria-hidden="true">+</div><h2>A place to begin.</h2>${infoOn(c)&&p.location?`<p>${esc(p.location)}</p>`:''}${infoOn(c)&&p.hours?`<p class="pro-hours">${esc(p.hours)}</p>`:''}${infoOn(c)?contactLines(c):''}${c.cta?button(c,`${wants(c,'Arrange a consultation')||'Make an enquiry'} ↗`):`<a class="pro-button" href="${esc(c.contactPage)}">Contact details ↗</a>`}${payAll(c)}${p.bookingUrl?'<small>Choose a time on the booking service.</small>':''}</aside></section>${heroPhoto(c)}`},
  trust:(c,_t,custom)=>`${ct(custom)}<ul class="practice-credentials">${items(c.p.credentials)}</ul>`,
  services:(c,t)=>`<section class="practice-services"><p class="pro-kicker">${esc(t)}</p><div>${c.p.services.map(s=>`<article>${svcPhoto(s)}<h2>${esc(s.name)}</h2>${s.description?`<p>${esc(s.description)}</p>`:''}${s.duration?`<p class="pro-price">${esc(s.duration)}</p>`:''}${s.bookingUrl?`<p><a class="pro-link" href="${esc(s.bookingUrl)}">Book ${esc(s.name)} ↗</a></p>`:''}${s.price?`<p class="pro-price">${esc(s.price)}</p>`:''}${serviceExtras(s)}</article>`).join('')}</div></section>`,
  about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 petal:{cls:'petal',t:{photos:'The room',services:'The treatment menu',story:'Our approach',about:'Our approach',trust:'Meet your practitioner',news:'Notes & journal'},
  hero:c=>`<section class="petal-opening">${head(c)}${actions(c,`${wants(c,'Find an appointment')||'Get in touch'} ↗`,'pro-link')}<span class="petal-flower" aria-hidden="true">✳</span></section>${heroPhoto(c)}`,
  services:(c,t)=>`<section class="petal-menu"><div><p class="pro-kicker">Time for you</p><h2>${esc(t)}</h2></div>${serviceMenuHtml(c.p.services)}</section>`,
  info:(c,_t,custom)=>`<section class="petal-about"><h2>${esc(custom||'Find us')}</h2><div>${c.p.location?`<p>${esc(c.p.location)}</p>`:''}${c.p.hours?`<p class="pro-hours">${esc(c.p.hours)}</p>`:''}${contactLines(c)}</div></section>`,
  trust:(c,t)=>`<section class="petal-about"><h2>${esc(t)}</h2><div>${lines(c.p.credentials)}</div></section>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 contour:{cls:'contour',t:{photos:'The clinic',services:'Treatments & consultations',story:'Our approach',about:'Meet the practitioner',trust:'People & practice',news:'Notes & journal'},infoInHero:true,
  hero:c=>{const p=c.p,details=infoOn(c)?`${p.location?`<p>${esc(p.location)}</p>`:''}${p.hours?`<p class="pro-hours">${esc(p.hours)}</p>`:''}${contactLines(c)}`:'',act=`${button(c,`${wants(c,'Book a consultation')||'Contact the practice'} ↗`)}${payAll(c)}`;return `<section class="contour-opening"><div>${head(c)}</div>${details||act?`<aside><span class="pro-number">Start here</span><h2>A consultation, at your pace.</h2>${details}${act}</aside>`:''}</section>${heroPhoto(c)}`},
  services:(c,t)=>`<section class="contour-treatments"><h2>${esc(t)}</h2>${serviceMenuHtml(c.p.services)}</section>`,
  trust:(c,t)=>`<section class="contour-profile"><h2>${esc(t)}</h2><div><ul>${items(c.p.credentials)}</ul></div></section>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 cut:{cls:'cut',pair:['services','info','cut-body'],t:{photos:'Our work',services:'The menu',story:'Our story',about:'Meet the team',trust:'',news:'Notes & journal'},
  hero:c=>{const p=c.p;return `<section class="cut-opening"><div class="cut-rail"><p class="pro-kicker">${esc(p.eyebrow||c.name)}</p>${p.location?`<span>${esc(p.location)}</span>`:''}</div><h1>${esc(p.heading||c.masthead)}</h1><div class="cut-intro"><p class="pro-intro">${esc(p.intro||c.tagline)}</p>${actions(c,`${wants(c,'Book a chair')||'Say hello'} ↗`)}</div></section>${heroPhoto(c)}`},
  services:(c,t)=>`<section><h2>${esc(t)}</h2>${serviceMenuHtml(c.p.services)}</section>`,
  info:(c,_t,custom)=>`<aside><h2>${esc(custom||'Find your chair.')}</h2>${c.p.hours?`<p class="pro-hours">${esc(c.p.hours)}</p>`:''}${c.p.location?`<p>${esc(c.p.location)}</p>`:''}${contactLines(c)}</aside>`,
  trust:(c,_t,custom)=>`<div class="pro-plain-list">${ct(custom)}${lines(c.p.credentials)}</div>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 still:{cls:'still',t:{photos:'The space',services:'Sessions',story:'A little about the practice',about:'Read more',trust:'',news:'Notes & journal'},
  hero:c=>`<section class="still-opening">${head(c)}${actions(c,`${wants(c,'Book a session')||'Get in touch'} ↗`)}</section>${heroPhoto(c)}`,
  services:(c,t,custom)=>`${ct(custom)}<section class="still-sessions" aria-label="${esc(t)}">${c.p.services.map((s,i)=>{const m=[s.duration,s.price].filter(Boolean).join(' · ');return `<article>${svcPhoto(s)}<span class="still-index">${num(i)}</span><h2>${esc(s.name)}</h2>${s.description?`<p>${esc(s.description)}</p>`:''}${m?`<p class="pro-price">${esc(m)}</p>`:''}${s.bookingUrl?`<a class="pro-link" href="${esc(s.bookingUrl)}">Book this session ↗</a>`:''}${serviceExtras(s)}</article>`}).join('')}</section>`,
  info:(c,_t,custom)=>`<section class="still-details"><div><h2>${esc(custom||'Find us')}</h2></div><div>${c.p.location?`<p>${esc(c.p.location)}</p>`:''}${c.p.hours?`<p class="pro-hours">${esc(c.p.hours)}</p>`:''}${contactLines(c)}</div></section>`,
  trust:(c,_t,custom)=>`<div class="pro-plain-list">${ct(custom)}${lines(c.p.credentials)}</div>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
 office:{cls:'office',t:{photos:'Recent work',services:'How I can help',story:'Experience & approach',about:'Experience & approach',trust:'Background',news:'Notes & journal'},
  hero:c=>`<section class="office-opening"><div><p class="pro-kicker">${esc(c.p.eyebrow||c.name)}</p><h1>${esc(c.p.heading||c.masthead)}</h1></div><div class="office-brief"><p class="pro-intro">${esc(c.p.intro||c.tagline)}</p>${actions(c,`${wants(c,'Book a call')||'Discuss a project'} ↗`)}</div></section>${heroPhoto(c)}`,
  services:(c,t)=>`<section class="office-services"><aside><p class="pro-kicker">Scope of work</p><h2>${esc(t)}</h2></aside>${serviceMenuHtml(c.p.services)}</section>`,
  info:(c,_t,custom)=>`<section class="office-profile"><span class="pro-kicker">${esc(custom||'Where and when')}</span>${c.p.location?`<p>${esc(c.p.location)}</p>`:''}${c.p.hours?`<p class="pro-hours">${esc(c.p.hours)}</p>`:''}${contactLines(c)}</section>`,
  trust:(c,t)=>`<section class="office-profile"><span class="pro-kicker">${esc(t)}</span>${lines(c.p.credentials)}</section>`,about:(c,t)=>`<p class="trade-about"><a class="pro-link" href="${esc(c.aboutHref)}">${esc(t)} ↗</a></p>`},
};
// Each trade's natural order until the writer changes it: a restaurant leads with its hours.
const THEME_ORDER={cut:['services','info','photos','story','trust','about','news'],table:['info','services','photos','story','trust','about','news'],shopfront:['info','services','photos','story','trust','about','news'],trade:['trust','services','photos','story','about','news','info'],practice:['trust','services','photos','story','about','news','info'],counsel:['services','photos','story','trust','info','about','news'],pulse:['services','photos','story','info','trust','about','news']};
export const sectionOrder=theme=>Object.hasOwn(THEME_ORDER,theme)?THEME_ORDER[theme]:ORDER;
export const BUSINESS_LAYOUTS=Object.keys(L);
export const defaultTitles=theme=>({...(Object.hasOwn(L,theme)?L[theme].t:{})});
export const infoSitsInOpening=theme=>Object.hasOwn(L,theme)&&!!L[theme].infoInHero;

const hasContent={photos:c=>c.p.gallery.length>0,services:c=>c.p.services.length>0,story:c=>!!c.p.story,info:c=>!!(c.p.hours||c.p.location||c.p.phone||c.p.email),trust:c=>c.p.credentials.length>0,about:()=>true,news:c=>c.posts.length>0};

export function renderBusinessHome({theme,site={},posts=[],aboutHref='/about/',postsHref='/posts/',contactPage='/contact/',appointmentsHref='/appointments/',resolveImage=i=>i,allowDataImages=false}){
 if(!Object.hasOwn(L,theme))return '';
 const layout=L[theme];
 const raw=site.professional||{},p0=professionalDetails(raw,{allowDataImages}),design=designDetails(site.design,sectionOrder(theme));
 const fix=i=>i?{...i,src:resolveImage(i.src)}:i;
 const p={...p0,heroImage:fix(p0.heroImage),gallery:p0.gallery.map(fix),services:p0.services.map(s=>({...s,image:fix(s.image)}))};
 const onMap=Object.fromEntries(design.sections.map(s=>[s.id,s.on]));
 const c={p,raw,posts,name:site.name||'',masthead:site.masthead||site.name||'',tagline:site.tagline||'',aboutHref,postsHref,contactPage,tel:telHref(p),cta:p.bookingUrl?appointmentsHref:contactHref(p),on:id=>onMap[id]!==false};
 const render=s=>{
  if(!s.on||!hasContent[s.id]?.(c))return '';
  const title=s.title||layout.t[s.id]||SECTION_LABELS[s.id];
  if(s.id==='photos')return `<section class="pro-gallery"><h2>${esc(title)}</h2><div>${p.gallery.map(i=>`<figure>${img(i,'')}${i.alt?`<figcaption>${esc(i.alt)}</figcaption>`:''}</figure>`).join('')}</div></section>`;
  if(s.id==='story')return `<section class="pro-story"><h2>${esc(s.title||p.storyTitle||layout.t.story)}</h2>${p.story.split(/\n\s*\n/).map(x=>`<p>${esc(x.trim())}</p>`).join('')}</section>`;
  if(s.id==='news')return `<section class="practice-notes"><div class="pro-section-head"><h2>${esc(title)}</h2><a href="${esc(postsHref)}">All posts ↗</a></div>${posts.slice(0,3).map(q=>`<a class="pro-post-row" href="${esc(q.href)}"><time>${esc(q.dateLabel||'')}</time><h3>${esc(q.title)}</h3><span aria-hidden="true">↗</span></a>`).join('')}</section>`;
  if(s.id==='info'&&layout.infoInHero)return '';
  const fn=layout[s.id];return fn?fn(c,title,s.title):(s.id==='info'?`<section class="pro-info"><h2>${esc(title)}</h2>${p.location?`<p>${esc(p.location)}</p>`:''}${p.hours?`<p class="pro-hours">${esc(p.hours)}</p>`:''}</section>`:'');
 };
 // Hidden and empty sections don't count, so two neighbours can still sit side by side.
 const shown=design.sections.map(s=>({s,h:render(s)})).filter(x=>x.h);
 const parts=[];
 for(let i=0;i<shown.length;i++){
  const a=shown[i],b=shown[i+1];
  if(layout.pair&&a.s.id===layout.pair[0]&&b?.s.id===layout.pair[1]){parts.push(`<div class="${layout.pair[2]}">${a.h}${b.h}</div>`);i++;continue;}
  parts.push(`<div class="pro-sec pro-sec-${a.s.id}">${a.h}</div>`);
 }
 const banner=design.bannerOn&&p.announcement?`<p class="pro-banner">${esc(p.announcement)}</p>`:'';
 return `<section class="pro-site ${layout.cls}">${banner}${layout.hero(c)}${parts.join('')}</section>`;
}

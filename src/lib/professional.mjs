// Public site details. Empty fields stay absent; no invented credentials or availability.
export const EMAIL_RE=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const PHONE_RE=/^[+\d ()-]{5,60}$/;
export const PROMO_RE=/^[A-Za-z0-9_-]{1,40}$/;
const text=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export function safeBookingUrl(value){
  try{const u=new URL(text(value,2048));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
// Pictures live in the site's own repository (/site-images/…) or at a full https address.
// `data:` images exist only in Chapbook's live preview, before the writer saves.
export function safeImage(value,allowData=false){
 const v=value&&typeof value==='object'?value:{src:value};
 const src=text(v.src,4000000),alt=text(v.alt,200);
 if(/^\/site-images\/[A-Za-z0-9._-]+$/.test(src)&&!src.includes('..'))return {src,alt};
 if(/^data:/i.test(src))return allowData&&/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(src)?{src,alt}:null;
 try{const u=new URL(src);return u.protocol==='https:'&&!u.username&&!u.password?{src:u.href,alt}:null;}catch{return null;}
}
export function professionalDetails(value={},{allowDataImages=false}={}){
  const pic=v=>safeImage(v,allowDataImages);
  const p=value&&typeof value==='object'?value:{};
  const email=text(p.email,254);
  const phone=text(p.phone,60);
  return {
    eyebrow:text(p.eyebrow,100),heading:text(p.heading,180),intro:text(p.intro,1800),
    location:text(p.location,300),hours:text(p.hours,300),
    email:EMAIL_RE.test(email)?email:'',
    phone:PHONE_RE.test(phone)?phone:'',
    bookingUrl:safeBookingUrl(p.bookingUrl),bookingLabel:text(p.bookingLabel,60)||'Book an appointment',
    services:(Array.isArray(p.services)?p.services:[]).filter(s=>s&&text(s.name)).slice(0,30).map(s=>({name:text(s.name,100),description:text(s.description,500),price:text(s.price,80),duration:text(s.duration,80),bookingUrl:safeBookingUrl(s.bookingUrl),paymentUrl:safeBookingUrl(s.paymentUrl),payLabel:text(s.payLabel,40),offer:text(s.offer,120),promoCode:PROMO_RE.test(text(s.promoCode,40))?text(s.promoCode,40):'',image:pic(s.image)})),
    paymentUrl:safeBookingUrl(p.paymentUrl),paymentLabel:text(p.paymentLabel,60),
    announcement:text(p.announcement,200),story:text(p.story,3000),storyTitle:text(p.storyTitle,100),
    heroImage:pic(p.heroImage),
    gallery:(Array.isArray(p.gallery)?p.gallery:[]).map(pic).filter(Boolean).slice(0,12),
    credentials:(Array.isArray(p.credentials)?p.credentials:[]).map(v=>text(v,160)).filter(Boolean).slice(0,8),
  };
}
export function contactHref(p){return p.bookingUrl || (p.email?'mailto:'+encodeURIComponent(p.email):p.phone?'tel:'+p.phone.replace(/[^+\d]/g,''):'');}


// Only the official Cal.com host is eligible for the embedded scheduler.
export function calBookingLink(value){
 const safe=safeBookingUrl(value);if(!safe)return '';
 const u=new URL(safe);
 if(!['cal.com','www.cal.com'].includes(u.hostname)||u.port)return '';
 const path=u.pathname.replace(/^\/+|\/+$/g,'');
 return /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+){1,3}$/.test(path)?path:'';
}

export function telHref(p){return p.phone?'tel:'+p.phone.replace(/[^+\d]/g,''):'';}
// The writer's own button wording wins; otherwise the theme's natural wording for its trade.
export function bookingText(raw,fallback){const own=text(raw&&raw.bookingLabel,60);return own||fallback;}

// A Stripe Payment Link can carry a promotion code, which Stripe fills in at checkout.
export function paymentHref(service){
 if(!service.paymentUrl)return '';
 if(!service.promoCode)return service.paymentUrl;
 const u=new URL(service.paymentUrl);
 if(u.hostname==='buy.stripe.com')u.searchParams.set('prefilled_promo_code',service.promoCode);
 return u.href;
}

// Menu links: same-site paths or https only. A leading // or backslash leaves the site.
export function safeNavHref(value){
 const v=text(value,300);
 if(/^\/(?![\/\\])[^\\\s\u0000-\u001f<>"']*$/.test(v))return v;
 return safeBookingUrl(v);
}

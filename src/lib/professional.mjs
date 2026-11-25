// Public site details. Empty fields stay absent; no invented credentials or availability.
// For search engines (business-schema.mjs): the kinds of business a website may name for itself, and
// schema.org's medical specialties.
export const SCHEMA_TYPES = [
  'LocalBusiness', 'MedicalClinic', 'MedicalBusiness', 'Physician', 'Dentist', 'Optician', 'Physiotherapy',
  'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon', 'NailSalon', 'ExerciseGym',
  'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'Store', 'Florist', 'ProfessionalService', 'LegalService',
  'AccountingService', 'FinancialService', 'HomeAndConstructionBusiness', 'Electrician', 'Plumber',
];
export const MEDICAL_SPECIALTIES = [
  'Anesthesia', 'Cardiovascular', 'CommunityHealth', 'Dentistry', 'Dermatology', 'DietNutrition', 'Emergency',
  'Endocrine', 'Gastroenterologic', 'Genetic', 'Geriatric', 'Gynecologic', 'Hematologic', 'Infectious',
  'LaboratoryScience', 'Midwifery', 'Musculoskeletal', 'Neurologic', 'Nursing', 'Obstetric', 'Oncologic',
  'Optometric', 'Otolaryngologic', 'Pathology', 'Pediatric', 'PharmacySpecialty', 'Physiotherapy',
  'PlasticSurgery', 'Podiatric', 'PrimaryCare', 'Psychiatric', 'PublicHealth', 'Pulmonary', 'Radiography',
  'Renal', 'RespiratoryTherapy', 'Rheumatologic', 'SpeechPathology', 'Surgical', 'Toxicologic', 'Urologic',
];

export const EMAIL_RE=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const PHONE_RE=/^[+\d ()-]{5,60}$/;
export const PROMO_RE=/^[A-Za-z0-9_-]{1,40}$/;
// Your services: how many, and what a block page card takes from one besides the standard fields.
export const MAX_SERVICES=60;
export const SERVICE_ID=/^[a-z0-9][a-z0-9-]{0,39}$/;
export const SERVICE_ACTS=['book','buy','join','ask','contact'];
// An https address kept exactly as typed (round B2 S1: a query or hash is the owner's), or ''.
export function typedHttps(value){const t=text(value,2048);return safeBookingUrl(t)?t:'';}
const serviceExtras=(s)=>{const o={};const id=text(s.id,40);if(SERVICE_ID.test(id)&&!/^n\d+$/.test(id))o.id=id;if(SERVICE_ACTS.includes(s.act))o.act=s.act;if(s.paid===true)o.paid=true;const m=typedHttps(s.manage);if(m)o.manage=m;const b=typedHttps(s.bookingUrl);if(b)o.bookingTyped=b;const pay=typedHttps(s.paymentUrl);if(pay)o.paymentTyped=pay;return o;};
const text=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export function safeBookingUrl(value){
  try{const u=new URL(text(value,2048));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
// Where a contact or sign-up form sends its messages. The starter's example address and an empty
// value both mean "no form yet", so no form is published for them.
export function formAddress(value){
  const u=safeBookingUrl(value);return u&&!u.includes('/your-id')?u:'';
}
// Starter wording that older websites still carry in their settings. It is never published.
const FILLER=new Set(['A line about your blog.','A sentence describing your blog — used for SEO and social cards.']);
export function ownText(value){const s=typeof value==='string'?value.trim():'';return FILLER.has(s)?'':s;}
// Two lines that say the same thing, whatever their capitals or spacing.
export function sameText(a,b){const n=v=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();return !!n(a)&&n(a)===n(b);}
// A browser title: "Page | Name". When both are the same the name is said once.
export function titleLine(title,name){
  const t=String(title??'').trim(),n=String(name??'').trim();
  return !t?n:!n||sameText(t,n)?t:`${t} | ${n}`;
}
// The town in an address: its last line without the postcode ("3 Church Lane\nWimborne BH21 1JH"
// gives "Wimborne"). Nothing when it is unclear.
export function townOf(location){
  const lines=String(location??'').split(/\n|,/).map((l)=>l.trim()).filter(Boolean);
  for(let i=lines.length-1;i>=0;i--){const t=lines[i].replace(/\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,'').trim();if(t&&!/\d/.test(t)&&t.length<=40)return t;}
  return '';
}
// A business home page's search title: what it does and where, from the business details
// ("Skin and aesthetics in Harrogate"), which titleLine follows with the website's name. With
// neither, the name alone, as before.
export function homeTitle(site){
  const s=site&&typeof site==='object'?site:{},p=s.professional&&typeof s.professional==='object'?s.professional:{};
  const what=String(p.eyebrow??'').replace(/\s+/g,' ').trim().slice(0,60),town=townOf(p.location);
  if(!what)return s.masthead||s.name||'';
  return town&&!what.toLowerCase().includes(town.toLowerCase())?`${what} in ${town}`:what;
}
// The line search engines show under the website's name: the owner's own description, else the
// tagline, else a plain sentence from the name. Never the name alone, and never starter wording.
export function siteDescription(site){
  const s=site&&typeof site==='object'?site:{};
  const name=ownText(s.masthead)||ownText(s.name);
  const real=v=>{const t=ownText(v);return t&&!sameText(t,s.masthead)&&!sameText(t,s.name)?t:'';};
  return real(s.description)||real(s.tagline)||(name?`Welcome to the website of ${name}.`:'');
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
// The business's own time zone, which "Open now" is worked out in (a visitor abroad still sees
// the practice's hours as they are). An IANA name the browser knows; Europe/London otherwise.
export const DEFAULT_TIME_ZONE='Europe/London';
export function cleanTimeZone(v){
 const z=text(v,60);
 if(!/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/.test(z))return DEFAULT_TIME_ZONE;
 try{new Intl.DateTimeFormat('en-GB',{timeZone:z});return z;}catch{return DEFAULT_TIME_ZONE;}
}
// The CQC's location ID (1-101641587), the latest overall rating and the day it was given. Only
// what the business has set; never a sample rating. `none`: the business says it is not
// registered with the CQC (most therapists, and everyone outside England), so no rating is shown
// and none is asked for.
const CQC_RATING_KEYS=['outstanding','good','requires-improvement','inadequate','none'];
const isoDay=(v)=>{const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s?s:'';};
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
    // Your services (round C): one list, which the standard pages draw and block page cards link to
    // by id. The id, the button words without a pay link, Pay when you book, a plan's manage link and
    // the booking link exactly as typed are kept for the cards (an older design ignores them).
    services:(Array.isArray(p.services)?p.services:[]).filter(s=>s&&text(s.name)).slice(0,MAX_SERVICES).map(s=>({...serviceExtras(s),name:text(s.name,100),description:text(s.description,500),price:text(s.price,80),duration:text(s.duration,80),bookingUrl:safeBookingUrl(s.bookingUrl),paymentUrl:safeBookingUrl(s.paymentUrl),payLabel:text(s.payLabel,40),offer:text(s.offer,120),promoCode:PROMO_RE.test(text(s.promoCode,40))?text(s.promoCode,40):'',image:pic(s.image)})),
    paymentUrl:safeBookingUrl(p.paymentUrl),paymentLabel:text(p.paymentLabel,60),
    announcement:text(p.announcement,200),story:text(p.story,3000),storyTitle:text(p.storyTitle,100),
    heroImage:pic(p.heroImage),
    gallery:(Array.isArray(p.gallery)?p.gallery:[]).map(pic).filter(Boolean).slice(0,12),
    credentials:(Array.isArray(p.credentials)?p.credentials:[]).map(v=>text(v,160)).filter(Boolean).slice(0,8),
    timeZone:cleanTimeZone(p.timeZone),
    // A short name for the business's time zone ("UK time"), typed once in Details and booking and
    // shown beside class and event times, so a visitor abroad knows whose clock they are.
    zoneLabel:text(p.zoneLabel,24),
    // The business has switched on booking emails and the day-before reminder in its own booking
    // service (Cal.com or Google), and ticked so in Details and booking. Only then does the website
    // promise them beside Book.
    reminders:p.reminders===true,
    cqcId:/^1-\d{6,12}$/.test(text(p.cqcId,20))?text(p.cqcId,20):'',
    cqcRating:CQC_RATING_KEYS.includes(p.cqcRating)?p.cqcRating:'',
    cqcDate:isoDay(p.cqcDate),
    // For search engines (src/lib/business-schema.mjs): a more exact kind of business than the
    // look's, and a medical business's specialties, each from schema.org's own lists.
    schemaType:SCHEMA_TYPES.includes(p.schemaType)?p.schemaType:'',
    specialty:(Array.isArray(p.specialty)?p.specialty:[p.specialty]).filter(s=>MEDICAL_SPECIALTIES.includes(s)).slice(0,4),
  };
}
// Opening hours, one row for each line the owner typed (app walk, 24 Nov: "Mon to Fri 9am to 6pm"
// on one line and "Sat 9am to 1pm" on the next are two rows wherever hours show; lines are never
// run together). Search engines read the same lines (business-schema.mjs openingHours).
export function hoursLines(value){return String(value??'').replace(/\r\n?/g,'\n').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);}
const escHtml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function hoursHtml(value){return hoursLines(value).map(l=>`<span class="hours-line">${escHtml(l)}</span>`).join('');}
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
// The menu gets a tab for the booking page by itself while a booking link is saved, unless the
// menu already has one or the owner switched it off in Chapbook (site.json `bookingTab: false`).
export function addsBookingTab(details,site,nav){return !!(details&&details.bookingUrl)&&!(site&&site.bookingTab===false)&&!(Array.isArray(nav)?nav:[]).some(n=>n&&n.href==='/appointments/');}
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

// Public site details. Empty fields stay absent; no invented credentials or availability.
const text=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export function safeBookingUrl(value){
  try{const u=new URL(text(value,2048));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export function professionalDetails(value={}){
  const p=value&&typeof value==='object'?value:{};
  const email=text(p.email,254);
  const phone=text(p.phone,60);
  return {
    eyebrow:text(p.eyebrow,100),heading:text(p.heading,180),intro:text(p.intro,1800),
    location:text(p.location,300),hours:text(p.hours,300),
    email:/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:'',
    phone:/^[+\d ()-]{5,60}$/.test(phone)?phone:'',
    bookingUrl:safeBookingUrl(p.bookingUrl),bookingLabel:text(p.bookingLabel,60)||'Book an appointment',
    services:(Array.isArray(p.services)?p.services:[]).filter(s=>s&&text(s.name)).slice(0,8).map(s=>({name:text(s.name,100),description:text(s.description,500),price:text(s.price,80),duration:text(s.duration,80),bookingUrl:safeBookingUrl(s.bookingUrl)})),
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

// Structured data (schema.org JSON-LD) for a business website, so search engines can read who the
// business is, where, when it is open and how to reach it. Made only from the details the business
// set once in Chapbook (Details & booking); nothing is guessed, and anything not set is left out.
//
// - The kind of business comes from the website's look (a clinic look is a MedicalClinic, an
//   aesthetics look a HealthAndBeautyBusiness, and so on), unless the details name a more exact
//   one from SCHEMA_TYPES (a consultant's practice is a Physician).
// - Medical kinds can carry a medicalSpecialty from schema.org's own list.
// - The address is read from the address lines (a UK postcode, then the town before it).
// - Opening hours are read the way the website's "Open now" line reads them (page-actions.js).
import { hoursOn, partlyClosed } from '../scripts/page-actions.js';
import { SCHEMA_TYPES, MEDICAL_SPECIALTIES } from './professional.mjs';

export { SCHEMA_TYPES, MEDICAL_SPECIALTIES };

/** The kind of business each business look stands for. */
export const LOOK_TYPES = {
  clinic: 'MedicalClinic', practice: 'MedicalBusiness', contour: 'HealthAndBeautyBusiness',
  petal: 'BeautySalon', cut: 'HairSalon', still: 'HealthAndBeautyBusiness', pulse: 'ExerciseGym',
  table: 'Restaurant', shopfront: 'Store', trade: 'HomeAndConstructionBusiness',
  counsel: 'ProfessionalService', office: 'ProfessionalService',
};

const MEDICAL = new Set(['MedicalClinic', 'MedicalBusiness', 'Physician', 'Dentist', 'Optician', 'Physiotherapy']);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i;
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const lines = (t) => String(t || '').split(/\n+/).map((x) => x.trim().replace(/,$/, '')).filter(Boolean);
const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) ? u : '');

/** The address lines as a PostalAddress, or null. */
export function postalAddress(location) {
  const ls = lines(location);
  if (!ls.length) return null;
  const last = ls[ls.length - 1];
  const pc = UK_POSTCODE.exec(last);
  if (!pc) return { '@type': 'PostalAddress', streetAddress: ls.join(', ') };
  const town = last.slice(0, pc.index).trim().replace(/,$/, '');
  const street = ls.slice(0, -1).join(', ');
  return {
    '@type': 'PostalAddress',
    ...(street ? { streetAddress: street } : {}),
    ...(town ? { addressLocality: town } : {}),
    postalCode: pc[1].toUpperCase().replace(/\s+/g, ' ').replace(/^(\S+?)(\d[A-Z]{2})$/, '$1 $2'),
    addressCountry: 'GB',
  };
}

/** The opening hours as openingHoursSpecification entries (days with the same times together). */
export function openingHours(hours) {
  const ls = lines(hours);
  const groups = new Map();
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    // A day closed for part of it or of the year is left out: search engines are told only what is certain.
    if (partlyClosed(ls, dow)) continue;
    for (const [a, b] of hoursOn(ls, dow) || []) {
      const key = `${a}-${b}`;
      if (!groups.has(key)) groups.set(key, { '@type': 'OpeningHoursSpecification', dayOfWeek: [], opens: clock(a), closes: clock(b) });
      groups.get(key).dayOfWeek.push(DAYS[dow]);
    }
  }
  return [...groups.values()];
}

/** The kind of business: the one it named, or its look's. Null for a website that is not a
 *  business (a blog or a personal website). */
export function businessType(look, named) {
  if (SCHEMA_TYPES.includes(named)) return named;
  return Object.hasOwn(LOOK_TYPES, look) ? LOOK_TYPES[look] : null;
}

/**
 * The business as JSON-LD, with the website it belongs to, or null for a website that is not a
 * business. `site` is site.json; `professional` its cleaned details (professionalDetails);
 * `url` the website's own address; `image` the opening photo's full address, if any.
 */
export function businessJsonLd({ site = {}, professional = {}, url = '', image = '', description = '' }) {
  const type = businessType(site.defaultTheme, professional.schemaType);
  if (!type) return null;
  const home = `${String(url || '').replace(/\/+$/, '')}/`;
  const id = `${home}#business`;
  const sameAs = [...new Set([...Object.values(site.socials || {}), ...(Array.isArray(professional.sameAs) ? professional.sameAs : [])].map(https).filter(Boolean))];
  const address = postalAddress(professional.location);
  const hours = openingHours(professional.hours);
  const specialty = MEDICAL.has(type) ? (Array.isArray(professional.specialty) ? professional.specialty : [professional.specialty]).filter((s) => MEDICAL_SPECIALTIES.includes(s)) : [];
  const business = {
    '@type': type,
    '@id': id,
    name: site.name || site.masthead || undefined,
    url: home,
    ...(description ? { description } : {}),
    ...(https(image) ? { image: https(image) } : {}),
    ...(professional.phone ? { telephone: professional.phone } : {}),
    ...(professional.email ? { email: professional.email } : {}),
    ...(address ? { address } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(specialty.length ? { medicalSpecialty: specialty.length === 1 ? specialty[0] : specialty } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${home}#website`, url: home, name: site.masthead || site.name || undefined, inLanguage: 'en-GB', publisher: { '@id': id } },
      business,
    ],
  };
}

const plain = (s) => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();

/** A page's questions and answers as FAQPage JSON-LD, or null when it has none. */
export function faqJsonLd(blocks = []) {
  const items = [];
  for (const b of blocks || []) {
    // A questions-first opening's questions are questions too (release 7).
    const list = b?.type === 'faq' ? b.data?.items : b?.type === 'hero' && b.variant === 'questions' ? b.data?.questions : null;
    for (const it of list || []) {
      const q = plain(it?.question), a = plain(it?.answer);
      if (q && a) items.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });
    }
  }
  return items.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items } : null;
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export const jsonLdText = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

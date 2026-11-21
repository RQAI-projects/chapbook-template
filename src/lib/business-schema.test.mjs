// Structured data for business websites (src/lib/business-schema.mjs): the right kind of business
// for each look, the details read from Details & booking, and the shape schema.org and Google's
// local business guidance expect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { businessJsonLd, businessType, postalAddress, openingHours, faqJsonLd, jsonLdText, LOOK_TYPES, SCHEMA_TYPES, MEDICAL_SPECIALTIES } from './business-schema.mjs';
import { professionalDetails } from './professional.mjs';

// schema.org's LocalBusiness and its subtypes that Chapbook may use (checked against
// schema.org/LocalBusiness, MedicalBusiness, HealthAndBeautyBusiness, FoodEstablishment, Store,
// ProfessionalService, FinancialService, HomeAndConstructionBusiness, SportsActivityLocation).
const LOCAL_BUSINESS = new Set(['LocalBusiness', 'MedicalClinic', 'MedicalBusiness', 'Physician', 'Dentist', 'Optician', 'Physiotherapy', 'HealthAndBeautyBusiness', 'BeautySalon', 'DaySpa', 'HairSalon', 'NailSalon', 'ExerciseGym', 'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'Store', 'Florist', 'ProfessionalService', 'LegalService', 'AccountingService', 'FinancialService', 'HomeAndConstructionBusiness', 'Electrician', 'Plumber']);
const DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

// The shape a local business must have to be read: a known type, its own id, a name, the website,
// and, where given, a full UK address, hours as HH:MM on named days, https links only.
function assertLocalBusiness(b) {
  assert.ok(LOCAL_BUSINESS.has(b['@type']), `unknown type ${b['@type']}`);
  assert.match(b['@id'], /^https:\/\/.+\/#business$/);
  assert.equal(typeof b.name, 'string'); assert.ok(b.name.length);
  assert.match(b.url, /^https:\/\/.+\/$/);
  if (b.telephone) assert.match(b.telephone, /^[+\d ()-]{5,}$/);
  if (b.address) {
    assert.equal(b.address['@type'], 'PostalAddress');
    for (const k of ['streetAddress', 'addressLocality', 'postalCode', 'addressCountry']) assert.equal(typeof b.address[k], 'string', k);
    assert.match(b.address.postalCode, /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/);
  }
  for (const h of b.openingHoursSpecification || []) {
    assert.equal(h['@type'], 'OpeningHoursSpecification');
    assert.ok(h.dayOfWeek.length && h.dayOfWeek.every((d) => DAYS.has(d)));
    assert.match(h.opens, /^([01]\d|2[0-3]):[0-5]\d$/); assert.match(h.closes, /^([01]\d|2[0-3]):[0-5]\d$/);
    assert.ok(h.opens < h.closes);
  }
  for (const s of b.sameAs || []) assert.match(s, /^https:\/\//);
  for (const s of [b.medicalSpecialty || []].flat()) assert.ok(MEDICAL_SPECIALTIES.includes(s));
  if (b.image) assert.match(b.image, /^https:\/\//);
}

const site = (look, professional = {}) => ({ name: 'Ashcombe Heart', masthead: 'Ashcombe Heart', defaultTheme: look, socials: { linkedin: 'https://www.linkedin.com/company/x', instagram: '', github: 'http://not-https.example' }, professional });
const details = { phone: '01632 960 123', email: 'hello@example.com', location: '12 Harley Street\nLondon W1G 9PF', hours: 'Monday to Friday, 9am to 6pm\nSaturday, 10am to 1pm\nSunday, closed' };

test('each business look is a kind of local business; blogs and personal websites are not', () => {
  for (const [look, type] of Object.entries(LOOK_TYPES)) { assert.equal(businessType(look), type); assert.ok(LOCAL_BUSINESS.has(type)); }
  assert.equal(businessType('clinic'), 'MedicalClinic');
  assert.equal(businessType('contour'), 'HealthAndBeautyBusiness');
  assert.equal(businessType('petal'), 'BeautySalon');
  for (const look of ['observatory', 'darkroom', 'folio', 'portrait', '', undefined]) assert.equal(businessType(look), null);
  // A business may name a more exact kind; an unknown name is ignored.
  assert.equal(businessType('practice', 'Physician'), 'Physician');
  assert.equal(businessType('practice', 'Hospital<script>'), 'MedicalBusiness');
  for (const t of SCHEMA_TYPES) assert.ok(LOCAL_BUSINESS.has(t), t);
  assert.equal(businessJsonLd({ site: site('observatory'), professional: details, url: 'https://x.example' }), null);
});

test('the address and opening hours are read from the details set once', () => {
  assert.deepEqual(postalAddress('12 Harley Street\nLondon W1G 9PF'), { '@type': 'PostalAddress', streetAddress: '12 Harley Street', addressLocality: 'London', postalCode: 'W1G 9PF', addressCountry: 'GB' });
  assert.deepEqual(postalAddress('Unit 4, The Old Mill,\nMill Lane\nFrome, ba113hq'), { '@type': 'PostalAddress', streetAddress: 'Unit 4, The Old Mill, Mill Lane', addressLocality: 'Frome', postalCode: 'BA11 3HQ', addressCountry: 'GB' });
  assert.deepEqual(postalAddress('Somewhere without a postcode'), { '@type': 'PostalAddress', streetAddress: 'Somewhere without a postcode' });
  assert.equal(postalAddress(''), null);
  assert.deepEqual(openingHours(details.hours), [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '10:00', closes: '13:00' },
  ]);
  assert.deepEqual(openingHours('Monday, 8.30am to 12.30pm and 2pm to 5.30pm'), [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday'], opens: '08:30', closes: '12:30' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday'], opens: '14:00', closes: '17:30' },
  ]);
  assert.deepEqual(openingHours('By appointment'), []);
});

test('a consultant doctor is a Physician with a specialty; the website names its business as publisher', () => {
  const pro = professionalDetails({ ...details, schemaType: 'Physician', specialty: 'Cardiovascular' });
  const ld = businessJsonLd({ site: site('practice'), professional: pro, url: 'https://ashcombeheart.co.uk/', image: 'https://ashcombeheart.co.uk/site-images/cbp-d1-heart-hero.webp', description: 'Private heart care in Bath.' });
  assert.equal(ld['@context'], 'https://schema.org');
  const [web, b] = ld['@graph'];
  assert.deepEqual(web, { '@type': 'WebSite', '@id': 'https://ashcombeheart.co.uk/#website', url: 'https://ashcombeheart.co.uk/', name: 'Ashcombe Heart', inLanguage: 'en-GB', publisher: { '@id': 'https://ashcombeheart.co.uk/#business' } });
  assertLocalBusiness(b);
  assert.equal(b['@type'], 'Physician');
  assert.equal(b.medicalSpecialty, 'Cardiovascular');
  assert.equal(b.telephone, '01632 960 123');
  assert.deepEqual(b.sameAs, ['https://www.linkedin.com/company/x']);
  assert.equal(b.description, 'Private heart care in Bath.');
  // A specialty is only for medical kinds, and only schema.org's own values.
  const salon = businessJsonLd({ site: site('contour'), professional: professionalDetails({ ...details, specialty: 'Cardiovascular' }), url: 'https://x.example' })['@graph'][1];
  assertLocalBusiness(salon);
  assert.equal(salon['@type'], 'HealthAndBeautyBusiness');
  assert.equal(salon.medicalSpecialty, undefined);
  assert.deepEqual(professionalDetails({ specialty: ['Gynecologic', 'Made up'] }).specialty, ['Gynecologic']);
  // With nothing set, only what is known is said.
  const bare = businessJsonLd({ site: { ...site('clinic'), socials: {} }, professional: professionalDetails({}), url: 'https://x.example' })['@graph'][1];
  assert.deepEqual(Object.keys(bare), ['@type', '@id', 'name', 'url']);
});

test('questions and answers become FAQPage data, in plain words', () => {
  const ld = faqJsonLd([{ type: 'hero', data: {} }, { type: 'faq', data: { items: [{ question: 'Do I need a referral?', answer: 'No. You can **book** yourself, or [ask your GP](/contact/).' }, { question: 'Empty', answer: '' }] } }]);
  assert.deepEqual(ld, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Do I need a referral?', acceptedAnswer: { '@type': 'Answer', text: 'No. You can book yourself, or ask your GP.' } }] });
  assert.equal(faqJsonLd([{ type: 'text', data: {} }]), null);
  assert.equal(jsonLdText({ a: '</script>' }), '{"a":"\\u003c/script>"}');
});

test('the home page and block pages publish it', () => {
  const home = readFileSync(new URL('../pages/index.astro', import.meta.url), 'utf8');
  assert.match(home, /businessJsonLd\(/);
  assert.match(home, /const jsonLd = businessLd \|\| blogJsonLd;/);
  assert.doesNotMatch(home, /'Organisation'/);
  assert.match(readFileSync(new URL('../components/BlockPage.astro', import.meta.url), 'utf8'), /faqJsonLd\(blocks\)/);
});

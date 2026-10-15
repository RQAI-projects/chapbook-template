import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBookingUrl,professionalDetails,contactHref,calBookingLink} from './professional.mjs';
test('booking links only accept HTTPS without embedded credentials',()=>{
 assert.equal(safeBookingUrl('javascript:alert(1)'),'');assert.equal(safeBookingUrl('https://user:secret@example.com'),'');
 assert.equal(safeBookingUrl('https://calendar.example.com/visit?type=first'),'https://calendar.example.com/visit?type=first');
 assert.equal(safeBookingUrl('//example.com'),'');assert.equal(safeBookingUrl('http://example.com'),'');
});
test('empty details never fabricate appointments, credentials or services',()=>{
 const p=professionalDetails();assert.equal(contactHref(p),'');assert.deepEqual(p.services,[]);assert.deepEqual(p.credentials,[]);
});
test('contact fallback and service details remain usable without booking',()=>{
 const p=professionalDetails({email:'hello@example.com',services:[{name:'Consultation',description:'An initial conversation',price:'By arrangement'}]});
 assert.equal(contactHref(p),'mailto:hello%40example.com');assert.equal(p.services[0].price,'By arrangement');
 assert.equal(professionalDetails({email:'a@b.com\nBcc:x@y.com'}).email,'');
});


test('only exact Cal.com event links can load the calendar embed',()=>{
 assert.equal(calBookingLink('https://cal.com/beauty/consultation'),'beauty/consultation');
 for(const u of ['https://cal.com.evil.test/user/event','https://evil.test/cal.com/user/event','https://cal.com:8443/u/e','https://cal.com','javascript:alert(1)','https://cal.com/u/%3Cscript%3E'])assert.equal(calBookingLink(u),'');
});
test('service booking links are sanitized independently and duration survives',()=>{
 const p=professionalDetails({services:[{name:'Facial',duration:'45 minutes',bookingUrl:'https://cal.com/studio/facial'},{name:'Invalid',bookingUrl:'javascript:alert(1)'}]});
 assert.equal(p.services[0].duration,'45 minutes');assert.equal(p.services[1].bookingUrl,'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBookingUrl,professionalDetails,contactHref,calBookingLink,formAddress,ownText,sameText,titleLine,siteDescription,addsBookingTab} from './professional.mjs';
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

test('the starter form address and an empty one both mean no form',()=>{
 for(const v of ['https://formspree.io/f/your-id','https://formspree.io/f/your-id/','','   ',null,undefined,'http://formspree.io/f/abc','javascript:alert(1)'])assert.equal(formAddress(v),'',String(v));
 assert.equal(formAddress('https://formspree.io/f/xabcdwxy'),'https://formspree.io/f/xabcdwxy');
});
test('starter wording is treated as empty and real wording is kept',()=>{
 assert.equal(ownText('A line about your blog.'),'');
 assert.equal(ownText(' A sentence describing your blog — used for SEO and social cards. '),'');
 assert.equal(ownText('Bread baked every morning.'),'Bread baked every morning.');
 assert.equal(ownText(null),'');
});
test('a browser title says the name once',()=>{
 assert.equal(titleLine('Harbour Bakery','Harbour Bakery'),'Harbour Bakery');
 assert.equal(titleLine(' harbour  bakery ','Harbour Bakery'),'harbour  bakery');
 assert.equal(titleLine('Contact','Harbour Bakery'),'Contact | Harbour Bakery');
 assert.equal(titleLine('','Harbour Bakery'),'Harbour Bakery');
 assert.equal(titleLine('Contact',''),'Contact');
 assert.ok(!/[\u2013\u2014]/.test(titleLine('Notes','Sam Reed')));
 assert.equal(sameText('',''),false);
});
test('the search description is never just the name or starter wording',()=>{
 const d=siteDescription;
 assert.equal(d({name:'Harbour Bakery',masthead:'Harbour Bakery',description:'Harbour Bakery',tagline:''}),'Welcome to the website of Harbour Bakery.');
 assert.equal(d({name:'Harbour Bakery',masthead:'Harbour Bakery',description:'',tagline:'Bread baked every morning.'}),'Bread baked every morning.');
 assert.equal(d({name:'Harbour Bakery',masthead:'Harbour Bakery',description:'A bakery on the quay.',tagline:'Bread baked every morning.'}),'A bakery on the quay.');
 assert.equal(d({name:'Your Name',masthead:'Your Blog Name',description:'A sentence describing your blog — used for SEO and social cards.',tagline:'A line about your blog.'}),'Welcome to the website of Your Blog Name.');
 assert.equal(d({}),'');assert.equal(d(null),'');
});
test('the menu gets a booking tab by itself only with a booking link, no tab of its own and no switch-off',()=>{
 const p=professionalDetails({bookingUrl:'https://cal.com/harbour/order'}),nav=[{href:'/',label:'Home'},{href:'/contact/',label:'Contact'}];
 assert.equal(addsBookingTab(p,{},nav),true);assert.equal(addsBookingTab(p,{bookingTab:true},nav),true);assert.equal(addsBookingTab(p,undefined,undefined),true);
 assert.equal(addsBookingTab(p,{bookingTab:false},nav),false);
 assert.equal(addsBookingTab(p,{},[...nav,{href:'/appointments/',label:'Book'}]),false);
 assert.equal(addsBookingTab(professionalDetails(),{},nav),false);assert.equal(addsBookingTab(professionalDetails({bookingUrl:'http://cal.com/x'}),{},nav),false);
});

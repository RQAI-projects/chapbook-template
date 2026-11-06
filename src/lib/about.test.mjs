import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aboutDetails } from './about.mjs';
const starter=JSON.parse(readFileSync(new URL('../data/profile.json',import.meta.url)));
test('the starter profile publishes no placeholder text',()=>{
 const a=aboutDetails(starter,{name:'Willow Skin Studio'},{});
 assert.equal(a.name,'Willow Skin Studio');
 assert.equal(a.role,'');assert.equal(a.tagline,'');
 assert.deepEqual(a.bio,[]);assert.deepEqual(a.stats,[]);
});
test('written details win, every paragraph is kept',()=>{
 const a=aboutDetails({name:'Sam Lee',role:'Skin therapist',bio:['One.','Two.'],stats:[{value:10,suffix:'',label:'Years'}]},{name:'Willow'},{eyebrow:'Beauty',intro:'Studio.'});
 assert.equal(a.name,'Sam Lee');assert.equal(a.role,'Skin therapist');assert.deepEqual(a.bio,['One.','Two.']);assert.equal(a.stats.length,1);
});
test('a business site falls back to its business details',()=>{
 const a=aboutDetails(starter,{name:'Willow'},{eyebrow:'Beauty and skin care',intro:'A small studio.',credentials:['CIDESCO diploma']});
 assert.equal(a.role,'Beauty and skin care');assert.deepEqual(a.bio,['A small studio.']);assert.deepEqual(a.highlights,['CIDESCO diploma']);
});

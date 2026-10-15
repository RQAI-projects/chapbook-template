import test from 'node:test';import assert from 'node:assert/strict';import {postCover} from './post-cover.mjs';
test('photo themes use real uploaded assets and preserve their descriptions',()=>{
 assert.deepEqual(postCover({},'![Morning light](./_images/walk/01.jpg)',{'_images/walk/01.jpg':'/_astro/01.hash.jpg'}),{src:'/_astro/01.hash.jpg',alt:'Morning light'});
 assert.deepEqual(postCover({image:'/images/cover.jpg'},'',{},'/notebook/'),{src:'/notebook/images/cover.jpg',alt:''});
 assert.equal(postCover({image:'/notebook/images/cover.jpg'},'',{},'/notebook/').src,'/notebook/images/cover.jpg');
 assert.equal(postCover({},'<img src="https://cdn.example.com/cover.jpg" alt="test">').src,'https://cdn.example.com/cover.jpg');
});
test('missing or unsafe images produce honest text-only cards',()=>{
 for(const image of ['javascript:alert(1)','//evil.example/a.jpg','https://u:p@example.com/a.jpg','./_images/../secret','/../secret','data:text/html,test'])assert.equal(postCover({image}),null);
 assert.equal(postCover({},'Text only'),null);assert.equal(postCover({},'![missing](./_images/missing.jpg)'),null);
});

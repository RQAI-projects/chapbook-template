import test from 'node:test';import assert from 'node:assert/strict';import remarkBasePath,{prefixInternalUrl,prefixHtmlUrls} from './remark-base-path.mjs';
test('raw published images, video and links respect a project base exactly once',()=>{
 const html='<figure><a href="/blog/a/"><img src="/images/posts/a/photo.png" alt="A &amp; B"></a><video src="/video/a.mp4" poster="/images/poster.png"></video></figure>';
 const out=prefixHtmlUrls(html,'/notebook');assert.match(out,/src="\/notebook\/images\/posts\/a\/photo.png"/);assert.match(out,/href="\/notebook\/blog\/a\/"/);assert.match(out,/poster="\/notebook\/images\/poster.png"/);assert.equal(prefixHtmlUrls(out,'/notebook'),out);assert.match(out,/alt="A &amp; B"/);
});
test('HTML URL editing preserves partial blocks, script text and external URLs',()=>{
 const source='<div><img src="/image.png"><script type="application/pg">const sample=\'<img src="/do-not-rewrite.png">\';</script>';
 const expected=source.replace('src="/image.png"','src="/site/image.png"');assert.equal(prefixHtmlUrls(source,'/site'),expected);
 for(const url of ['https://example.com/a','//cdn.example.com/a','data:image/png;base64,AAAA','#figure','relative.png'])assert.equal(prefixInternalUrl(url,'/site'),url);
 assert.equal(prefixHtmlUrls('<img src="/a.png">',''),'<img src="/a.png">');
});
test('attribute entities and quote styles remain safe',()=>{
 assert.equal(prefixHtmlUrls("<img src='/a.png?x=1&amp;y=2'>",'/site'),'<img src="/site/a.png?x=1&amp;y=2">');
 assert.equal(prefixHtmlUrls('<img src=/a.png>','/site'),'<img src="/site/a.png">');
});
test('markdown links, references and raw image blocks all use the same base',()=>{
 const previous=process.env.BASE_PATH;process.env.BASE_PATH='/project/';
 try{const tree={children:[{type:'image',url:'/img.png'},{type:'definition',url:'/blog/a/'},{type:'html',value:'<img src="/img.png">'},{type:'code',value:'<img src="/untouched.png">'}]};remarkBasePath()(tree);assert.equal(tree.children[0].url,'/project/img.png');assert.equal(tree.children[1].url,'/project/blog/a/');assert.equal(tree.children[2].value,'<img src="/project/img.png">');assert.equal(tree.children[3].value,'<img src="/untouched.png">');}finally{if(previous===undefined)delete process.env.BASE_PATH;else process.env.BASE_PATH=previous;}
});

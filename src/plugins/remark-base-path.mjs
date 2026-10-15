import {parseFragment} from 'parse5';

export function prefixInternalUrl(url,prefix){
 if(!prefix||typeof url!=='string'||!url.startsWith('/')||url.startsWith('//'))return url;
 if(url===prefix||url.startsWith(prefix+'/')||url.startsWith(prefix+'?')||url.startsWith(prefix+'#'))return url;
 return prefix+url;
}
const attributeText=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

// Edit only parsed URL attributes at their original offsets. Serialising the whole
// fragment would close partial HTML blocks; regex replacement could alter script text.
export function prefixHtmlUrls(html,prefix){
 if(!prefix||typeof html!=='string')return html;
 const tree=parseFragment(html,{sourceCodeLocationInfo:true}),edits=[];
 const visit=node=>{
  for(const attr of node.attrs||[]){
   if(!['src','href','poster'].includes(attr.name))continue;
   const value=prefixInternalUrl(attr.value,prefix);if(value===attr.value)continue;
   const name=attr.prefix?attr.prefix+':'+attr.name:attr.name;
   const loc=node.sourceCodeLocation?.attrs?.[name];if(!loc)continue;
   edits.push({start:loc.startOffset,end:loc.endOffset,text:`${name}="${attributeText(value)}"`});
  }
  for(const child of node.childNodes||[])visit(child);
  if(node.content)visit(node.content);
 };
 visit(tree);
 for(const edit of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,edit.start)+edit.text+html.slice(edit.end);
 return html;
}

export default function remarkBasePath(){
 const prefix=(process.env.BASE_PATH||'/').replace(/\/$/,'');
 return tree=>{
  if(!prefix)return;
  const visit=node=>{
   if(!node||typeof node!=='object')return;
   if(['link','image','definition'].includes(node.type))node.url=prefixInternalUrl(node.url,prefix);
   if(node.type==='html')node.value=prefixHtmlUrls(node.value,prefix);
   if(Array.isArray(node.children))node.children.forEach(visit);
  };
  visit(tree);
 };
}

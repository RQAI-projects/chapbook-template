// Resolve an existing post image; never manufacture a photograph for a photo theme.
export function postCover(data,body='',assets={},base='/'){
 const md=body.match(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/);
 const html=body.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
 const candidate=data?.image||md?.[2]||html?.[1]||'';
 const alt=data?.image?'':md?.[1]||'';
 if(typeof candidate!=='string')return null;
 if(/^https?:\/\//i.test(candidate)){try{const u=new URL(candidate);return u.username||u.password?null:{src:u.href,alt};}catch{return null;}}
 if(candidate.startsWith('/')&&!candidate.startsWith('//')){
  if(candidate.includes('..')||/[<>\x00-\x1f]/.test(candidate))return null;
  const prefix=base.replace(/\/$/,'');return {src:prefix&&candidate.startsWith(prefix+'/')?candidate:prefix+candidate,alt};
 }
 const key=candidate.replace(/^\.\//,'');
 if(!key.startsWith('_images/')||key.split('/').some(s=>s==='..'||s===''))return null;
 return assets[key]?{src:assets[key],alt}:null;
}

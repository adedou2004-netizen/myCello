/* Mandarin to Go — portable local backup v1. No server calls.
   ZIP files use the STORE method so exports work offline without an external library.
   Only application-owned keys and images from the dedicated IndexedDB store are included. */
(function(global){
"use strict";
const VERSION=1, DBNAME="mandarin-to-go-assets", STORE="files";
const KEYS=["mandarinAppV2","mandarinExpressionsV1","rad60_i","rad60_done","hanzi-review","hanzi-current","mandarinPendingPinyin"];
const LIMIT=150*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder();
const U=n=>new Uint8Array(n);
const u16=(a,i,n)=>{a[i]=n&255;a[i+1]=(n>>>8)&255};
const u32=(a,i,n)=>{u16(a,i,n);u16(a,i+2,n>>>16)};
const r16=(a,i)=>a[i]|(a[i+1]<<8);
const r32=(a,i)=>(a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24)>>>0;
const crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function concat(chunks){const total=chunks.reduce((n,c)=>n+c.length,0);if(total>LIMIT)throw Error("Backup exceeds 150 MB limit.");const a=U(total);let p=0;for(const c of chunks){a.set(c,p);p+=c.length}return a}
function zip(files){
 const chunks=[],central=[];let pos=0;
 for(const [name,data] of files){
  const n=enc.encode(name),bytes=data instanceof Uint8Array?data:enc.encode(data);
  if(n.length>65535 || bytes.length>LIMIT)throw Error("File too large");
  const crc=crc32(bytes),h=U(30+n.length);
  u32(h,0,0x04034b50);u16(h,4,20);u16(h,8,0);u32(h,14,crc);u32(h,18,bytes.length);u32(h,22,bytes.length);u16(h,26,n.length);h.set(n,30);
  const c=U(46+n.length);
  u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,10,0);u32(c,16,crc);u32(c,20,bytes.length);u32(c,24,bytes.length);u16(c,28,n.length);u32(c,42,pos);c.set(n,46);
  chunks.push(h,bytes);central.push(c);pos+=h.length+bytes.length;
 }
 const cd=concat(central),end=U(22);
 u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,cd.length);u32(end,16,pos);
 return concat([...chunks,cd,end]);
}
function unzip(input){
 const a=input instanceof Uint8Array?input:new Uint8Array(input);if(a.length>LIMIT)throw Error("File exceeds 150 MB limit.");
 let e=-1;for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--){if(r32(a,i)===0x06054b50){e=i;break}}
 if(e<0)throw Error("Not a valid Mandarin to Go ZIP file.");
 const count=r16(a,e+10),start=r32(a,e+16),size=r32(a,e+12);
 if(count>10000||start+size>a.length)throw Error("Invalid ZIP directory.");
 let p=start;const files=new Map();
 for(let j=0;j<count;j++){
  if(p+46>a.length||r32(a,p)!==0x02014b50)throw Error("Damaged ZIP directory.");
  const method=r16(a,p+10),crc=r32(a,p+16),compressed=r32(a,p+20),uncompressed=r32(a,p+24),nl=r16(a,p+28),extra=r16(a,p+30),comment=r16(a,p+32),local=r32(a,p+42);
  const name=dec.decode(a.slice(p+46,p+46+nl));
  if(!name||name.includes("..")||name.startsWith("/")||name.includes("\\")||files.has(name))throw Error("Invalid ZIP entry name.");
  if(method!==0||compressed!==uncompressed)throw Error("Only Mandarin to Go uncompressed backups are supported.");
  if(local+30>a.length||r32(a,local)!==0x04034b50)throw Error("Damaged ZIP entry.");
  const off=local+30+r16(a,local+26)+r16(a,local+28);
  if(off+compressed>a.length)throw Error("Truncated ZIP entry.");
  const data=a.slice(off,off+compressed);
  if(crc32(data)!==crc)throw Error("ZIP checksum failed: "+name);
  files.set(name,data);p+=46+nl+extra+comment;
 }
 return files;
}
function openAssets(){
 return new Promise((resolve,reject)=>{
  if(!global.indexedDB){resolve(null);return}
  const request=indexedDB.open(DBNAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
  request.onerror=()=>reject(request.error||Error("Cannot open local image storage"));
  request.onsuccess=()=>resolve(request.result);
 });
}
async function readAssets(){
 const db=await openAssets();if(!db)return [];
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly"),store=tx.objectStore(STORE),list=[];
  const cur=store.openCursor();
  cur.onerror=()=>reject(cur.error);cur.onsuccess=async()=>{
   const c=cur.result;if(!c)return;
   list.push([String(c.key),c.value]);c.continue();
  };
  tx.oncomplete=()=>resolve(list);tx.onerror=()=>reject(tx.error);
 })}finally{db.close()}
}
async function writeAssets(items,replace){
 if(!items.length)return;
 const db=await openAssets();if(!db)throw Error("Browser does not support image storage.");
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
  if(replace)store.clear();
  for(const [key,blob] of items)store.put(blob,key);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("Image restore aborted"));
 })}finally{db.close()}
}
function validate(key,value){
 if(key==="mandarinAppV2")return value&&typeof value==="object"&&!Array.isArray(value)&&Array.isArray(value.entries)&&Array.isArray(value.lessons)&&Array.isArray(value.examples)&&value.reviews&&typeof value.reviews==="object";
 if(key==="mandarinExpressionsV1"||key==="rad60_done")return Array.isArray(value);
 if(key==="rad60_i")return Number.isInteger(+value)&&+value>=0&&+value<60;
 return typeof value==="string"||value!==undefined;
}
function parsed(key,value){if(["mandarinAppV2","mandarinExpressionsV1","rad60_done","hanzi-review","hanzi-current","mandarinPendingPinyin"].includes(key)){try{return JSON.parse(value)}catch(_){return value}}return value}
function mergeKey(key,current,incoming){
 if(!current)return incoming;
 let a,b;try{a=JSON.parse(current);b=JSON.parse(incoming)}catch(_){return current}
 if(key==="mandarinAppV2"){
  if(!a||!b||!Array.isArray(a.entries)||!Array.isArray(b.entries))return current;
  const result=JSON.parse(JSON.stringify(a)),ids=new Map(),existing=new Set(result.entries.map(x=>x.simplified+"|"+(x.pinyin||"")));
  for(const ent of b.entries){if(!ent||typeof ent.simplified!=="string")continue;
   const match=result.entries.find(x=>x.simplified===ent.simplified&&(x.pinyin||"")===(ent.pinyin||""));
   if(match){ids.set(ent.id,match.id);continue}
   const copy={...ent};if(result.entries.some(x=>x.id===copy.id))copy.id="import-"+crypto.randomUUID();
   ids.set(ent.id,copy.id);result.entries.push(copy);existing.add(copy.simplified+"|"+(copy.pinyin||""));
  }
  result.lessons=result.lessons||[];
  for(const lesson of b.lessons||[]){
   const found=result.lessons.find(x=>x.id===lesson.id||x.title===lesson.title&&x.kind===lesson.kind);
   const entries=(lesson.items||[]).map(id=>ids.get(id)).filter(Boolean);
   if(found)found.items=[...new Set([...(found.items||[]),...entries])];
   else {const copy={...lesson,items:entries};if(result.lessons.some(x=>x.id===copy.id))copy.id="import-"+crypto.randomUUID();result.lessons.push(copy)}
  }
  result.examples=result.examples||[];
  for(const ex of b.examples||[]){const copy={...ex,entryId:ids.get(ex.entryId)};if(!copy.entryId)continue;
   if(!result.examples.some(x=>x.entryId===copy.entryId&&x.surface===copy.surface&&x.source===copy.source)){
    if(result.examples.some(x=>x.id===copy.id))copy.id="import-"+crypto.randomUUID();result.examples.push(copy)
   }
  }
  result.reviews=result.reviews||{};
  for(const [id,v] of Object.entries(b.reviews||{})){const mapped=ids.get(id);if(mapped&&!Object.hasOwn(result.reviews,mapped))result.reviews[mapped]=v}
  result.palace=result.palace||{};
  for(const [id,v] of Object.entries(b.palace||{})){const mapped=ids.get(id);if(mapped&&!Object.hasOwn(result.palace,mapped))result.palace[mapped]=v}
  return JSON.stringify(result);
 }
 if(key==="mandarinExpressionsV1"&&Array.isArray(a)&&Array.isArray(b)){
  const seen=new Set(a.map(x=>x.word));for(const x of b)if(x&&typeof x.word==="string"&&!seen.has(x.word)){a.push(x);seen.add(x.word)}return JSON.stringify(a)
 }
 if(key==="rad60_done"&&Array.isArray(a)&&Array.isArray(b))return JSON.stringify([...new Set([...a,...b])]);
 return current; // For unknown legacy shapes, protect existing local data
}
async function exportBackup(){
 const values={};for(const key of KEYS){const value=localStorage.getItem(key);if(value!==null)values[key]=value}
 const assets=await readAssets();
 const manifest={format:"mandarin-to-go-backup",version:VERSION,created_at:new Date().toISOString(),origin:location.origin,keys:Object.keys(values),asset_count:assets.length};
 const files=[["manifest.json",JSON.stringify(manifest)],["local-storage.json",JSON.stringify(values)]];
 for(let i=0;i<assets.length;i++){
  const [id,v]=assets[i],blob=v instanceof Blob?v:(v?.blob instanceof Blob?v.blob:null);
  if(!blob)continue;
  const name="assets/"+String(i).padStart(5,"0")+".bin";
  files.push([name,new Uint8Array(await blob.arrayBuffer())]);
  if(!manifest.assets)manifest.assets=[];
  manifest.assets.push({id,name,type:blob.type||"application/octet-stream"});
 }
 files[0][1]=JSON.stringify(manifest);
 const bytes=zip(files),date=new Date().toISOString().slice(0,10),blob=new Blob([bytes],{type:"application/zip"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="mandarin-to-go-backup-"+date+".zip";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return {keys:Object.keys(values).length,assets:assets.length,size:bytes.length};
}
async function inspectBackup(file){
 if(!file||file.size>LIMIT)throw Error("Choose a backup ZIP smaller than 150 MB.");
 const files=unzip(await file.arrayBuffer()),manifest=JSON.parse(dec.decode(files.get("manifest.json")||U(0)));
 if(manifest.format!=="mandarin-to-go-backup"||manifest.version!==VERSION)throw Error("Unsupported backup version.");
 const incoming=JSON.parse(dec.decode(files.get("local-storage.json")||U(0)));
 if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))throw Error("Invalid backup data.");
 const keys=Object.keys(incoming);
 if(keys.some(k=>!KEYS.includes(k)))throw Error("Backup contains unexpected storage keys.");
 for(const [k,v] of Object.entries(incoming)){
  if(typeof v!=="string"||v.length>10*1024*1024||!validate(k,parsed(k,v)))throw Error("Invalid storage data: "+k);
 }
 if(!Array.isArray(manifest.assets))manifest.assets=[];
 if(manifest.assets.length>10000)throw Error("Too many images in backup.");
 const assets=[];
 for(const a of manifest.assets){
  if(!a||typeof a.id!=="string"||typeof a.name!=="string"||!/^assets\/\d{5}\.bin$/.test(a.name))throw Error("Invalid image manifest.");
  const bytes=files.get(a.name);if(!bytes)throw Error("Missing image: "+a.name);
  if(bytes.length>20*1024*1024)throw Error("Image exceeds 20 MB.");
  if(a.type&&!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(a.type))throw Error("Unsupported image type.");
  assets.push([a.id,new Blob([bytes],{type:a.type||"application/octet-stream"})]);
 }
 return {manifest,incoming,assets,keys,overlaps:keys.filter(k=>localStorage.getItem(k)!==null),newKeys:keys.filter(k=>localStorage.getItem(k)===null)};
}
async function restoreBackup(preview,mode){
 if(!preview||!["merge","replace"].includes(mode))throw Error("Choose Merge or Replace.");
 const before=new Map(KEYS.map(k=>[k,localStorage.getItem(k)]));
 // Construct the entire new state before committing any browser changes.
 const next=new Map();
 for(const [k,v] of Object.entries(preview.incoming)){
  next.set(k,mode==="merge"?mergeKey(k,localStorage.getItem(k),v):v);
 }
 try{
  for(const [k,v] of next)localStorage.setItem(k,v);
  await writeAssets(preview.assets,mode==="replace");
 }catch(error){
  for(const [k,v] of before){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}
  throw Error("Restore failed. Original text data was returned to its previous state: "+error.message);
 }
 return {keys:next.size,assets:preview.assets.length};
}

async function storePersonalImage(id,file){
 if(!id||!/^personal-[a-z0-9-]{1,100}$/.test(id))throw Error("Invalid image ID.");
 if(!file||!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>10*1024*1024)throw Error("Please choose a PNG, JPEG, WEBP or GIF under 10 MB.");
 await writeAssets([[id,file]],false);
 return id;
}
async function loadPersonalImage(id){
 const db=await openAssets();if(!db)return null;
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly"),q=tx.objectStore(STORE).get(id);
  q.onsuccess=()=>resolve(q.result instanceof Blob?q.result:q.result?.blob||null);
  q.onerror=()=>reject(q.error);
 })}finally{db.close()}
}

global.MandarinBackup={exportBackup,inspectBackup,restoreBackup,storePersonalImage,loadPersonalImage,keys:KEYS};
})(window);

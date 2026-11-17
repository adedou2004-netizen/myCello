const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const {IDBFactory}=require('fake-indexeddb');const fs=require('node:fs');const path=require('node:path');
const vm=require('node:vm');
const dir=path.join(__dirname,'..');const tick=()=>new Promise(r=>setTimeout(r,30));
function app(storage){
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
 const dom=new JSDOM(html,{url:'https://capture.test/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.indexedDB=new IDBFactory();w.confirm=()=>true;w.prompt=()=>null;w.fetch=async()=>({ok:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.URL.createObjectURL=()=>`blob:test-${Math.random()}`;w.URL.revokeObjectURL=()=>{};
 if(storage)w.localStorage.setItem('mandarinAppV2',JSON.stringify(storage));
 const context=dom.getInternalVMContext();const run=code=>vm.runInContext(code,context);run(fs.readFileSync(path.join(dir,'capture-core.js'),'utf8'));run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(path.join(dir,'capture.js'),'utf8'));run("select('capture')");
 return {dom,w,$:id=>w.document.getElementById(id),run};
}
const manual=(a,text)=>{a.$('capManual').click();a.$('capText').value=text;a.$('capText').dispatchEvent(new a.w.Event('input'));a.$('capConfirm').click();};
test('manual correction → confirmation → existing entry → save → reload preserves source and prevents duplicates',async()=>{
 const a=app();manual(a,'她今天非常高兴。');assert.equal(a.$('capSave').disabled,true);a.run('captureSetSelection(0,1)');assert.equal(a.$('capExisting').selectedOptions[0].textContent.includes('她'),true);a.$('capTranslation').value='She is very happy today.';a.$('capNote').value='Book page 3';a.$('capSave').click();await tick();a.$('capSave').click();await tick();
 const saved=JSON.parse(a.w.localStorage.getItem('mandarinAppV2'));assert.equal(saved.entries.filter(e=>e.simplified==='她').length,1);assert.equal(saved.examples.filter(e=>e.surface==='她今天非常高兴。').length,1);assert.equal(saved.examples.find(e=>e.surface==='她今天非常高兴。').note,'Book page 3');assert.equal(saved.entries.find(e=>e.simplified==='她').meaning,'she; her');
 const b=app(saved);assert.equal(b.run('db.examples.some(e=>e.surface==="她今天非常高兴。")'),true);a.dom.window.close();b.dom.window.close();
});
test('new expression stays out of Today SRS until third lesson practice pass',async()=>{const a=app();manual(a,'她今天非常高兴。');a.run('captureSetSelection(3,5)');a.$('capLesson').value='L1';a.$('capSave').click();await tick();const id=a.run('db.entries.find(e=>e.simplified==="非常").id');assert.equal(a.run(`dueIds().includes('${id}')`),false);a.run(`CaptureCore.practice(db,'${id}',true);CaptureCore.practice(db,'${id}',true)`);assert.equal(a.run(`dueIds().includes('${id}')`),false);a.run(`CaptureCore.practice(db,'${id}',true)`);assert.equal(a.run(`db.entries.find(e=>e.id==='${id}').srsEligible`),true);a.dom.window.close();});
test('editing verified text disables save and stores corrected draft',async()=>{const a=app();manual(a,'她今天非常');a.run('captureSetSelection(0,1)');a.$('capText').value='她今天很好';a.$('capText').dispatchEvent(new a.w.Event('input'));assert.equal(a.$('capSave').disabled,true);await a.run('capturePersistDraft()');const draft=await a.run("captureDraftStore('get')");assert.equal(draft.text,'她今天很好');assert.equal(draft.verified,false);a.dom.window.close();});
test('storage quota failure does not publish a partial vocabulary transaction or claim success',async()=>{const a=app();manual(a,'她今天非常');a.run('captureSetSelection(3,5)');a.w.Storage.prototype.setItem=function(){throw new a.w.DOMException('Full','QuotaExceededError');};a.$('capSave').click();await tick();assert.equal(a.run('db.entries.some(e=>e.simplified==="非常")'),false);assert.match(a.$('capStatus').textContent,/Not saved/);assert.equal(a.$('capText').value,'她今天非常');a.dom.window.close();});
test('second-tab changes are detected before vocabulary save',async()=>{const a=app();manual(a,'她今天非常');a.run('captureSetSelection(3,5)');a.w.localStorage.setItem('mandarinAppV2','{"otherTab":true}');a.$('capSave').click();await tick();assert.match(a.$('capStatus').textContent,/another tab/);assert.equal(a.w.localStorage.getItem('mandarinAppV2'),'{"otherTab":true}');a.dom.window.close();});
test('camera permission resolving after leaving stops every track',async()=>{const a=app();let resolve;let stopped=0;a.w.navigator.mediaDevices={getUserMedia:()=>new Promise(r=>resolve=r)};a.$('capOpen').click();a.run("select('library')");resolve({getTracks:()=>[{stop:()=>stopped++}]});await tick();assert.equal(stopped,1);a.dom.window.close();});
test('diagnostics and displayed crop are the same blob submitted to OCR; raw lines preserved',async()=>{const a=app();let received;const blob=new a.w.Blob(['real-crop'],{type:'image/png'});a.w.testCrop=blob;a.run('captureCropBlob=testCrop');a.w.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async b=>{received=b;return {data:{text:'她今天非常。\n人人都好。',confidence:90,lines:[]}};},terminate:async()=>{}})};
 await a.run('captureRecognize()');assert.equal(received,blob);assert.equal(a.$('capText').value,'她今天非常。\n人人都好。');assert.equal(a.$('capSave').disabled,true);assert.match(a.run('captureDiagnostic.raw'),/人人/);a.dom.window.close();});
test('late OCR after cancel cannot replace manually corrected text',async()=>{const a=app();let finish;a.w.testCrop=new a.w.Blob(['crop']);a.run('captureCropBlob=testCrop');a.w.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:()=>new Promise(r=>finish=r),terminate:async()=>{}})};const promise=a.run('captureRecognize()');await tick();a.$('capCancel').click();manual(a,'她今天很好');finish({data:{text:'错误',confidence:90}});await promise;assert.equal(a.$('capText').value,'她今天很好');a.dom.window.close();});
test('OCR engine error clears prior output and never falls back to sample characters',async()=>{const a=app();manual(a,'她今天非常');a.w.testCrop=new a.w.Blob(['crop']);a.run('captureCropBlob=testCrop');a.w.Tesseract={createWorker:async()=>{throw Error('model download unavailable');}};await a.run('captureRecognize()');assert.equal(a.$('capText').value,'');assert.match(a.$('capStatus').textContent,/Recognition failed/);assert.equal(a.$('capSave').disabled,true);a.dom.window.close();});
test('crop preview draws only selected source pixels and exposes that exact blob to recognition',async()=>{const a=app();let draw;const crop=new a.w.Blob(['selected-pixels'],{type:'image/png'});Object.defineProperty(a.$('capPhoto'),'naturalWidth',{value:3000});Object.defineProperty(a.$('capPhoto'),'naturalHeight',{value:2000});a.$('capOptimize').checked=false;a.w.HTMLCanvasElement.prototype.getContext=()=>({drawImage:(...args)=>{draw=args;}});a.w.HTMLCanvasElement.prototype.toBlob=function(fn){fn(crop);};a.run('captureCrop={x:.25,y:.5,w:.5,h:.25}');await a.run('capturePreviewCrop()');assert.deepEqual(draw.slice(1),[750,1000,1500,500,0,0,1500,500]);assert.equal(a.run('captureCropBlob'),crop);assert.match(a.$('capCropPreview').src,/blob:test/);a.dom.window.close();});
test('restoring a draft retains manual pinyin, translation and selected expression',async()=>{const a=app();manual(a,'她今天非常');a.run('captureSetSelection(3,5)');a.$('capPinyin').value='fēicháng';a.$('capMeaning').value='very';a.$('capTranslation').value='She is very…';await a.run('capturePersistDraft()');const draft=await a.run("captureDraftStore('get')");a.w.savedDraft=draft;a.run('captureResume=savedDraft;captureSession.clear();captureForm={};captureRestore()');assert.equal(a.$('capPinyin').value,'fēicháng');assert.equal(a.$('capMeaning').value,'very');assert.equal(a.$('capTranslation').value,'She is very…');assert.equal(a.run('captureSelection.text'),'非常');a.dom.window.close();});
test('captured source text is rendered as text, never as injected HTML',async()=>{const a=app();manual(a,'她<script>alert(1)</script>');a.run('captureSetSelection(0,captureSession.text.length)');a.$('capKind').value='sentence';a.$('capSave').click();await tick();a.run("select('library')");assert.equal(a.w.document.querySelectorAll('#app script').length,0);assert.match(a.$('app').textContent,/<script>/);a.dom.window.close();});
test('changing the crop preserves corrected text as an unverified draft',()=>{const a=app();manual(a,'她今天很好');a.run('captureChangeCrop({x:.1,y:.1,w:.8,h:.8})');assert.equal(a.$('capText').value,'她今天很好');assert.equal(a.run('captureSession.verified'),false);assert.match(a.$('capStatus').textContent,/kept as a draft/);a.dom.window.close();});

test('opening camera clears previous capture, form, selection and recovery draft without changing vocabulary',async()=>{
 const a=app();manual(a,'她今天非常');a.run('captureSetSelection(0,1)');a.$('capSource').value='Old book';a.$('capPinyinCorrect').value='wu';a.run('captureOfferPinyin();capturePhoto=new Blob(["old-photo"]);captureCropBlob=new Blob(["old-crop"]);capturePhotoURL="blob:old-photo";captureCropURL="blob:old-crop"');
 await a.run('capturePersistDraft()');const before=a.run('JSON.stringify(db)');
 let resolve;a.w.navigator.mediaDevices={getUserMedia:()=>new Promise(r=>resolve=r)};a.$('capOpen').click();
 for(const id of ['capCropPanel','capReview','capSavePanel','capRecover'])assert.equal(a.$(id).classList.contains('hidden'),true,id);
 for(const id of ['capText','capPinyinCorrect','capSource','capPinyin','capMeaning'])assert.equal(a.$(id).value,'',id);
 assert.equal(a.$('capPinyinChoices').children.length,0);assert.equal(a.$('capPhoto').hasAttribute('src'),false);
 assert.equal(a.run('capturePhoto'),null);assert.equal(a.run('captureCropBlob'),null);assert.equal(a.run('captureSelection'),null);assert.equal(a.$('capSave').disabled,true);
 await a.run('captureDraftWrites');assert.equal(await a.run("captureDraftStore('get')"),undefined);assert.equal(a.run('JSON.stringify(db)'),before);
 a.run("select('library')");resolve({getTracks:()=>[{stop(){}}]});await tick();a.dom.window.close();
});
test('new photo shows crop step while review remains hidden until recognition',async()=>{
 const a=app();manual(a,'她今天非常');a.w.photo=new a.w.Blob(['new-photo']);await a.run('captureAcceptPhoto(photo)');
 assert.equal(a.$('capCropPanel').classList.contains('hidden'),false);assert.equal(a.$('capReview').classList.contains('hidden'),true);assert.equal(a.$('capText').value,'');a.dom.window.close();
});
test('reset invalidates late recognition results',async()=>{
 const a=app();let finish;a.w.testCrop=new a.w.Blob(['crop']);a.run('captureCropBlob=testCrop');a.w.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:()=>new Promise(r=>finish=r),terminate:async()=>{}})};
 const pending=a.run('captureRecognize()');await tick();a.run('captureReset()');finish({data:{text:'旧照片',confidence:90}});await pending;
 assert.equal(a.$('capText').value,'');assert.equal(a.$('capReview').classList.contains('hidden'),true);assert.equal(a.$('capSave').disabled,true);a.dom.window.close();
});

test('complete existing September entry, link HSK, reload and keep English hidden',async()=>{
 const a=app();a.run("db.entries.push({id:'september',simplified:'九月',pinyin:'',meaning:'',type:'expression'});db.lessons.push({id:'hsk',title:'HSK',items:[]});captureRender()");
 manual(a,'九月');a.run('captureSetSelection(0,2)');
 assert.equal(a.$('capPinyin').readOnly,false);assert.equal(a.$('capMeaning').readOnly,false);
 a.$('capPinyin').value='jiǔyuè';a.$('capMeaning').value='September';a.$('capLesson').value='hsk';a.$('capSave').click();await tick();
 assert.match(a.$('capStatus').textContent,/saved to lesson: HSK/);
 const saved=JSON.parse(a.w.localStorage.getItem('mandarinAppV2'));
 assert.equal(saved.entries.filter(e=>e.simplified==='九月').length,1);assert.equal(saved.entries.find(e=>e.id==='september').pinyin,'jiǔyuè');assert.equal(saved.entries.find(e=>e.id==='september').meaning,'September');
 const b=app(saved);b.run("openLesson('hsk')");assert.equal(b.w.document.querySelector('.py').textContent,'jiǔyuè');assert.equal(b.$('englishAnswer').textContent,'September');assert.equal(b.$('englishAnswer').classList.contains('hidden'),true);
 b.w.document.querySelector('[data-act="english"]').click();assert.equal(b.$('englishAnswer').classList.contains('hidden'),false);
 a.dom.window.close();b.dom.window.close();
});
test('existing pinyin and meaning remain protected while missing French can be completed',async()=>{
 const a=app();manual(a,'她');a.run('captureSetSelection(0,1)');assert.equal(a.$('capPinyin').readOnly,true);assert.equal(a.$('capMeaning').readOnly,true);assert.equal(a.$('capMeaningFr').readOnly,false);
 a.$('capMeaningFr').value='elle';a.$('capSave').click();await tick();assert.equal(a.run("db.entries.find(e=>e.simplified==='她').meaning_fr"),'elle');assert.match(a.$('capStatus').textContent,/Dictionary only/);a.dom.window.close();
});

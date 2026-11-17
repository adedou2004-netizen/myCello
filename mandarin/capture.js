/* Camera → immutable photo → exact crop → OCR → verified text → local vocabulary. */
'use strict';
const C=CaptureCore;
const captureSession=new C.Session();
let capturePhoto=null,capturePhotoURL='',captureCropURL='',captureCropBlob=null,captureCrop={x:0,y:0,w:1,h:1};
let captureStream=null,captureCameraEpoch=0,captureWorkerPromise=null,captureWorkerEpoch=0,captureSelection=null,captureLastIndex=null;
let captureDraftTimer=null,captureMounted=false,captureDBPromise=null,captureDraftEpoch=0,captureDraftWrites=Promise.resolve(),captureDiagnostic={},captureOrigin='manual',captureSaving=false;
let captureForm={},captureResume=null,captureRange=false;
const captureId=()=>crypto.randomUUID();
const cap=id=>document.getElementById(id);
function captureMessage(message,error=false){const e=cap('capStatus');if(e){e.textContent=message;e.classList.toggle('error',error);}}
function captureEsc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function captureDB(){
  if(!captureDBPromise) captureDBPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('myCelloCapture',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }).catch(e=>{captureDBPromise=null;throw e;});
  return captureDBPromise;
}
async function captureDraftStore(action,value){
  const database=await captureDB();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('drafts',action==='get'?'readonly':'readwrite'),store=tx.objectStore('drafts');
    const request=action==='get'?store.get('current'):action==='delete'?store.delete('current'):store.put(value,'current');
    let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Draft transaction cancelled.'));
  });
}
function captureCollect(){
  for(const name of ['capPinyin','capMeaning','capMeaningFr','capTranslation','capSourcePinyin','capSource','capNote','capLesson','capKind','capExisting']) if(cap(name))captureForm[name]=cap(name).value;
}
function captureQueueDraft(){
  clearTimeout(captureDraftTimer);captureDraftTimer=setTimeout(()=>capturePersistDraft(),250);
}
function capturePersistDraft(){
  captureCollect();const epoch=captureDraftEpoch;
  const snapshot={version:1,text:captureSession.text,raw:captureSession.raw,verified:captureSession.verified,photo:capturePhoto,crop:{...captureCrop},form:{...captureForm},origin:captureOrigin,selection:captureSelection,updatedAt:Date.now()};
  captureDraftWrites=captureDraftWrites.catch(()=>{}).then(()=>{if(epoch!==captureDraftEpoch)return;return captureDraftStore('put',snapshot);});
  captureDraftWrites.catch(()=>captureMessage('Draft recovery is unavailable. Keep this tab open and export a backup after saving.',true));
  return captureDraftWrites;
}
async function captureDeleteDraft(){
  clearTimeout(captureDraftTimer);captureDraftEpoch++;
  captureDraftWrites=captureDraftWrites.catch(()=>{}).then(()=>captureDraftStore('delete'));
  await captureDraftWrites;
}
function captureRender(){
  captureMounted=true;
  cap('app').innerHTML=`<section class="capture" aria-label="Capture Chinese text">
  <div class="card"><h2>1 · Take a picture</h2><p class="privacy">Photos and recognition stay on this device. Internet is needed the first time OCR assets load.</p>
  <div id="capRecover" class="hidden"><p>A previous capture draft is available.</p><div class="actions"><button id="capRestore">Restore draft</button><button id="capDiscard">Discard draft</button></div></div>
  <div id="capCamera" class="camera-view hidden"><video id="capVideo" autoplay playsinline muted aria-label="Live camera preview"></video></div>
  <div class="actions"><button id="capOpen" class="primary">Open camera</button><button id="capShutter" class="hidden primary">Take picture</button><button id="capChoose">Choose image</button><button id="capManual">Enter text manually</button></div>
  <input id="capFile" class="hidden" type="file" accept="image/*"><p id="capCameraStatus" role="status"></p></div>
  <div id="capCropPanel" class="card hidden"><h2>2 · Select the text area</h2><p id="capCropHelp" class="muted">Drag the green box or its corners. With a keyboard: arrows move, Shift + arrows resize. Keep pinyin annotations outside the box when possible.</p>
  <div class="crop-stage" id="capStage"><img id="capPhoto" alt="Frozen captured photograph"><div class="crop-box" id="capBox" tabindex="0" role="group" aria-label="Text crop. Arrow keys move; Shift and arrows resize." aria-describedby="capCropHelp">${['nw','ne','sw','se'].map(h=>`<button type="button" class="crop-handle" data-handle="${h}" aria-label="Resize ${h} corner"></button>`).join('')}</div></div>
  <div class="actions"><button id="capFull">Use full image</button><button id="capRotate">Rotate 90°</button><button id="capRetake">Retake / new image</button></div>
  <label class="note"><input id="capOptimize" type="checkbox" checked style="width:auto"> Optimize oversized printed text</label><p class="muted">The preview below shows the exact OCR image, including any size optimization.</p><h3>Exact crop for recognition</h3><img id="capCropPreview" class="crop-preview" alt="Exact image crop that will be sent to OCR">
  <label for="capLayout">Text layout</label><select id="capLayout"><option value="6">Paragraph / multiple lines</option><option value="7">Single line</option></select>
  <div class="actions"><button id="capRecognize" class="primary">3 · Recognize selected area</button><button id="capCancel" class="hidden">Cancel recognition</button></div><progress id="capProgress" max="1" value="0" class="hidden" aria-label="Recognition progress"></progress></div>
  <div id="capReview" class="card hidden"><h2>4 · Review and correct</h2><p class="muted">Compare with the crop above. Correct every mistake before confirming. Pinyin annotations are not vocabulary.</p>
  <label for="capText">Recognized Chinese text — please check</label><textarea id="capText" class="chinese" lang="zh-Hans" spellcheck="false" rows="4"></textarea>
  <div class="pinyin-correction" style="margin:14px 0;padding:12px;border:1px solid #d7ded5;border-radius:12px">
  <label for="capPinyinCorrect">Correct with pinyin (keep your English keyboard)</label>
  <p class="muted" style="margin:6px 0">Tap a wrong character in the text above, type pinyin below, then tap the correct Chinese character. For a missing character, place the cursor where it belongs.</p>
  <input id="capPinyinCorrect" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="e.g. wu, wu3, xia, xia4">
  <div id="capPinyinChoices" class="actions" aria-label="Chinese character suggestions" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px"></div>
  <p id="capPinyinHelp" class="muted" aria-live="polite">Suggestions come from your dictionary and common characters. Check each choice against the photograph.</p>
  </div>
  <div class="actions"><button id="capConfirm" class="primary">Confirm corrected text</button></div><p id="capVerified" role="status"></p>
  <div id="capSavePanel" class="hidden"><h3>5 · Select and save</h3><p class="muted">Tap a character. For a phrase, enable Select range and tap the first and last characters. You can also highlight text in the field above and press Use highlighted text.</p>
  <div id="capTokens" class="selection" aria-label="Select characters from confirmed text"></div><div class="actions"><button id="capRange" aria-pressed="false">Select range</button><button id="capUseHighlight">Use highlighted text</button><button id="capSelectAll">Select whole text</button></div>
  <p id="capSelected" lang="zh-Hans" style="font-size:32px;white-space:pre-wrap"></p>
  <label for="capKind">Save as</label><select id="capKind"><option value="character">Character</option><option value="expression">Expression</option><option value="sentence">Sentence</option></select>
  <label for="capExisting">Existing dictionary entry</label><select id="capExisting"><option value="">Select text first</option></select>
  <p id="capLookup" class="muted"></p><div class="fields">
  <div><label for="capPinyin">Word pinyin (tone marks)</label><input id="capPinyin" placeholder="Check the reading in this context"></div>
  <div><label for="capMeaning">Word meaning in English</label><input id="capMeaning"></div>
  <div><label for="capMeaningFr">Word meaning in French (optional)</label><input id="capMeaningFr"></div>
  <div><label for="capSourcePinyin">Pinyin in this source context (optional)</label><input id="capSourcePinyin" placeholder="Confirm context-dependent readings"></div><div><label for="capTranslation">Source sentence translation (optional)</label><input id="capTranslation"></div>
  <div><label for="capSource">Source title / page (optional)</label><input id="capSource"></div>
  <div><label for="capNote">Personal context note (optional)</label><input id="capNote"></div></div>
  <p class="muted">The complete confirmed text is preserved as the source. Dictionary suggestions are editable; a character may have a different reading in context.</p>
  <label for="capLesson">Add to lesson</label><div class="row"><select id="capLesson" style="flex:1"><option value="">Dictionary only</option>${db.lessons.map(l=>`<option value="${captureEsc(l.id)}">${captureEsc(l.title)}</option>`).join('')}</select><button id="capNewLesson">New lesson</button></div>
  <p class="muted">New vocabulary enters global SRS after three successful lesson passes.</p><div class="actions"><button id="capSave" class="primary" disabled>Save selected text</button></div></div></div>
  <div class="card"><p id="capStatus" class="status" role="status" aria-live="polite"></p><div id="capSaved"></div>
  <details><summary>Backup and recovery</summary><p class="muted">Export your dictionary, lessons, examples, and review history. Import restores a backup; export first to keep your current data.</p><div class="actions"><button id="capExport">Export backup</button><button id="capImport">Restore backup</button></div><input type="file" accept="application/json,.json" id="capBackupFile" class="hidden"></details>
  <details id="capDiagnostics" class="hidden"><summary>Development diagnostics</summary><p>The crop above is the exact OCR input. Diagnostics remain in this tab.</p><pre id="capDebug"></pre></details></div></section>`;
  for(const [id,fn] of Object.entries({capOpen:captureOpenCamera,capShutter:captureShutter,capChoose:()=>cap('capFile').click(),capManual:captureManual,capFull:()=>captureChangeCrop({x:0,y:0,w:1,h:1}),capRotate:captureRotate,capRetake:captureRetake,capRecognize:captureRecognize,capCancel:()=>{captureCancel();captureUpdateVerified();captureMessage('Recognition cancelled. Retry or enter text manually.');},capConfirm:captureConfirm,capRange:()=>{captureRange=!captureRange;captureLastIndex=null;cap('capRange').setAttribute('aria-pressed',String(captureRange));cap('capRange').textContent=captureRange?'Range on: tap first, then last':'Select range';},capUseHighlight:captureHighlight,capSelectAll:()=>captureSetSelection(0,captureSession.text.length),capSave:captureSave,capNewLesson:captureNewLesson,capExport:captureExport,capImport:()=>cap('capBackupFile').click(),capRestore:captureRestore,capDiscard:captureDiscard})) cap(id).onclick=fn;
  cap('capFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(file)await captureReadFile(file);};
  cap('capBackupFile').onchange=e=>captureImport(e.target.files[0]);
  cap('capText').oninput=()=>{captureSession.edit(cap('capText').value);captureSelection=null;captureLastIndex=null;captureUpdateVerified();captureQueueDraft();};
  cap('capText').addEventListener('click',captureRememberCursor);
  cap('capText').addEventListener('keyup',captureRememberCursor);
  cap('capText').addEventListener('select',captureRememberCursor);
  cap('capPinyinCorrect').addEventListener('input',captureOfferPinyin);
  cap('capPinyinCorrect').addEventListener('focus',captureOfferPinyin);
  cap('capExisting').onchange=()=>{captureFillEntry();captureQueueDraft();};
  for(const id of ['capPinyin','capMeaning','capMeaningFr','capTranslation','capSourcePinyin','capSource','capNote','capLesson','capKind'])cap(id).oninput=()=>{captureQueueDraft();captureUpdateSave();};
  cap('capOptimize').onchange=()=>captureChangeCrop({...captureCrop});
  cap('capLayout').onchange=()=>{captureCancel();captureSession.verified=false;captureUpdateVerified();};
  captureBindCrop();
  const debug=location.hostname==='localhost'||location.hostname==='127.0.0.1'||new URLSearchParams(location.search).get('captureDebug')==='1';
  cap('capDiagnostics').classList.toggle('hidden',!debug);
  if(captureSession.text||capturePhoto){captureShowState();}
  else {const epoch=captureDraftEpoch;captureDraftStore('get').then(draft=>{if(captureMounted&&epoch===captureDraftEpoch&&draft){captureResume=draft;cap('capRecover').classList.remove('hidden');}}).catch(()=>captureMessage('Draft recovery is unavailable in this browser.',true));}
}
function captureShowState(){
  if(!captureMounted)return;
  cap('capCropPanel').classList.toggle('hidden',!capturePhoto);
  cap('capReview').classList.toggle('hidden',!capturePhoto&&!captureSession.text&&captureOrigin!=='manual');
  cap('capText').value=captureSession.text;
  for(const [name,value] of Object.entries(captureForm))if(cap(name))cap(name).value=value;
  if(capturePhoto)captureDisplayPhoto();
  captureUpdateVerified();if(captureSelection){const form={...captureForm};captureSetSelection(captureSelection.start,captureSelection.end);for(const [name,value] of Object.entries(form))if(cap(name))cap(name).value=value;}
}
async function captureRestore(){
  const d=captureResume;if(!d)return;
  captureSession.clear();captureSession.text=String(d.text||'');captureSession.raw=String(d.raw||'');captureSession.verified=!!d.verified&&C.han(captureSession.text);
  capturePhoto=d.photo||null;captureCrop=d.crop||{x:0,y:0,w:1,h:1};captureForm=d.form||{};captureOrigin=d.origin||'manual';captureSelection=d.selection||null;
  cap('capRecover').classList.add('hidden');captureShowState();captureMessage('Draft restored. Check the text and selected word before saving.');
}
async function captureDiscard(){
  try{await captureDeleteDraft();captureResume=null;cap('capRecover').classList.add('hidden');captureMessage('Draft discarded.');}catch(e){captureMessage('Could not discard the saved draft.',true);}
}
function captureStopCamera(){
  captureCameraEpoch++;if(captureStream){captureStream.getTracks().forEach(t=>t.stop());captureStream=null;}
  if(cap('capVideo'))cap('capVideo').srcObject=null;
  if(cap('capCamera'))cap('capCamera').classList.add('hidden');
  if(cap('capShutter'))cap('capShutter').classList.add('hidden');
}
async function captureOpenCamera(){
  captureStopCamera();const epoch=captureCameraEpoch;
  if(!navigator.mediaDevices?.getUserMedia){captureMessage('Camera is unavailable. Choose an image or enter text manually.',true);return;}
  cap('capCameraStatus').textContent='Opening camera…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    if(epoch!==captureCameraEpoch||!captureMounted){stream.getTracks().forEach(t=>t.stop());return;}
    captureStream=stream;const v=cap('capVideo');v.srcObject=stream;cap('capCamera').classList.remove('hidden');await v.play();
    if(epoch!==captureCameraEpoch||!captureMounted)return;
    cap('capShutter').classList.remove('hidden');cap('capCameraStatus').textContent='Take a picture, then select the text on the frozen photograph.';
  }catch(e){if(epoch!==captureCameraEpoch||!captureMounted)return;captureStopCamera();cap('capCameraStatus').textContent=e.name==='NotAllowedError'?'Camera permission was denied. Choose an image, or enable camera access in your browser.':e.name==='NotFoundError'?'No camera was found. Choose an image instead.':'Camera could not start. Close other camera apps and retry, or choose an image.';}
}
function captureCanvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the image.')),'image/png'));}
async function captureShutter(){
  const v=cap('capVideo');if(!v?.videoWidth||v.readyState<2){captureMessage('The camera is not ready yet. Try again.',true);return;}
  captureCancel();captureSession.clear();captureSelection=null;captureLastIndex=null;captureCropBlob=null;capturePreviewEpoch++;captureUpdateVerified();cap('capText').value='';cap('capCropPanel').classList.add('hidden');captureClearSaved();const token=captureSession.revision;
  try{const canvas=document.createElement('canvas');canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext('2d').drawImage(v,0,0);const blob=await captureCanvasBlob(canvas);if(!captureMounted||token!==captureSession.revision)return;await captureAcceptPhoto(blob);captureStopCamera();}catch(e){captureMessage(e.message,true);}
}
async function captureReadFile(file){
  // ImageBitmap applies EXIF orientation once; storing the normalized PNG avoids double rotation.
  captureCancel();captureSession.clear();captureSelection=null;captureLastIndex=null;captureCropBlob=null;capturePreviewEpoch++;captureUpdateVerified();cap('capText').value='';cap('capCropPanel').classList.add('hidden');captureClearSaved();const token=captureSession.revision;
  captureMessage('Opening image…');
  try{
    const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    if(!captureMounted||token!==captureSession.revision){bitmap.close();return;}
    if(bitmap.width*bitmap.height>36000000){bitmap.close();throw Error('This image is too large for mobile recognition. Choose a photo under 36 megapixels.');}
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
    const blob=await captureCanvasBlob(canvas);if(!captureMounted||token!==captureSession.revision)return;
    await captureAcceptPhoto(blob);captureStopCamera();
  }catch(e){captureMessage('Could not open that image. Try JPEG, PNG, or a screenshot. '+e.message,true);}
}
async function captureAcceptPhoto(blob){
  captureCancel();captureSession.clear();captureDraftEpoch++;capturePhoto=blob;captureOrigin='photo';captureCrop={x:0,y:0,w:1,h:1};captureSelection=null;captureLastIndex=null;captureForm={};captureResume=null;
  cap('capRecover').classList.add('hidden');captureClearSaved();captureShowState();captureMessage('Photograph frozen. Select the text area, check the crop, then recognize.');captureQueueDraft();
}
function captureDisplayPhoto(){
  if(capturePhotoURL)URL.revokeObjectURL(capturePhotoURL);capturePhotoURL=URL.createObjectURL(capturePhoto);
  const image=cap('capPhoto');image.onload=()=>{capturePositionBox();capturePreviewCrop();};image.src=capturePhotoURL;
}
function capturePositionBox(){const box=cap('capBox');if(box){Object.assign(box.style,{left:captureCrop.x*100+'%',top:captureCrop.y*100+'%',width:captureCrop.w*100+'%',height:captureCrop.h*100+'%'});box.setAttribute('aria-label',`Text crop: left ${Math.round(captureCrop.x*100)}%, top ${Math.round(captureCrop.y*100)}%, width ${Math.round(captureCrop.w*100)}%, height ${Math.round(captureCrop.h*100)}%. Arrow keys move; Shift and arrows resize.`);}}
function captureChangeCrop(next){
  captureCancel();captureCrop=next;captureSession.raw='';captureSelection=null;captureLastIndex=null;captureClearSaved();captureDiagnostic={...captureDiagnostic,raw:'',lines:[],state:'Crop changed; previous recognition invalidated'};capturePositionBox();captureUpdateVerified();if(captureSession.text)captureMessage('Crop changed. Your corrected text is kept as a draft. Recognize again, or check and confirm the draft.');capturePreviewCrop();captureQueueDraft();
}
let capturePreviewEpoch=0;
async function capturePreviewCrop(){
  const image=cap('capPhoto');if(!image?.naturalWidth)return;
  const epoch=++capturePreviewEpoch;captureCropBlob=null;cap('capRecognize').disabled=true;
  const p=C.cropPixels(captureCrop,image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
  canvas.getContext('2d').drawImage(image,p.x,p.y,p.width,p.height,0,0,p.width,p.height);
  try{
    let ocrCanvas=canvas,scale=1;
    if(cap('capOptimize').checked){
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,rows=new Uint32Array(canvas.height);
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if((pixels[i]+pixels[i+1]+pixels[i+2])/3<160)rows[y]++;}
      scale=C.textScale(rows,canvas.width);
      if(scale!==1){ocrCanvas=document.createElement('canvas');ocrCanvas.width=Math.max(1,Math.round(canvas.width*scale));ocrCanvas.height=Math.max(1,Math.round(canvas.height*scale));ocrCanvas.getContext('2d').drawImage(canvas,0,0,ocrCanvas.width,ocrCanvas.height);}
    }
    const blob=await captureCanvasBlob(ocrCanvas);if(!captureMounted||epoch!==capturePreviewEpoch)return;
    if(captureCropURL)URL.revokeObjectURL(captureCropURL);captureCropURL=URL.createObjectURL(blob);captureCropBlob=blob;cap('capCropPreview').src=captureCropURL;cap('capRecognize').disabled=false;
    captureDiagnostic={...captureDiagnostic,source:{width:image.naturalWidth,height:image.naturalHeight},crop:p,ocrImage:{width:ocrCanvas.width,height:ocrCanvas.height,scale}};captureDebug();
  }catch(e){captureMessage(e.message,true);}
}
function captureBindCrop(){
  const box=cap('capBox');let drag=null;
  box.onpointerdown=e=>{if(e.button!==0)return;const p=C.point(e.clientX,e.clientY,cap('capPhoto').getBoundingClientRect());drag={pointer:e.pointerId,start:{...captureCrop},p,handle:e.target.dataset.handle||'move'};box.setPointerCapture(e.pointerId);e.preventDefault();};
  box.onpointermove=e=>{if(!drag||e.pointerId!==drag.pointer)return;const p=C.point(e.clientX,e.clientY,cap('capPhoto').getBoundingClientRect());captureCrop=C.moveCrop(drag.start,p.x-drag.p.x,p.y-drag.p.y,drag.handle);capturePositionBox();};
  box.onpointerup=box.onpointercancel=e=>{if(!drag||e.pointerId!==drag.pointer)return;drag=null;captureChangeCrop({...captureCrop});};
  box.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0,dy=e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0;captureChangeCrop(C.moveCrop(captureCrop,dx,dy,e.shiftKey?(e.target.dataset.handle||'se'):'move'));};
}
async function captureRotate(){
  if(!capturePhoto)return;captureCancel();const token=++captureSession.revision;
  try{const bitmap=await createImageBitmap(capturePhoto);const canvas=document.createElement('canvas');canvas.width=bitmap.height;canvas.height=bitmap.width;const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(bitmap,0,0);bitmap.close();const blob=await captureCanvasBlob(canvas);if(!captureMounted||token!==captureSession.revision)return;capturePhoto=blob;captureChangeCrop({x:0,y:0,w:1,h:1});captureDisplayPhoto();}catch(e){captureMessage('Could not rotate the image.',true);}
}
function captureClearSaved(){if(cap('capSaved'))cap('capSaved').replaceChildren();}
async function captureRetake(){
  if(captureSession.text&&!confirm('Start a new capture? The current text draft will be replaced.'))return;
  captureCancel();captureSession.clear();capturePhoto=null;capturePreviewEpoch++;captureCropBlob=null;captureSelection=null;captureLastIndex=null;captureForm={};
  if(capturePhotoURL)URL.revokeObjectURL(capturePhotoURL);if(captureCropURL)URL.revokeObjectURL(captureCropURL);capturePhotoURL='';captureCropURL='';
  cap('capCropPanel').classList.add('hidden');cap('capReview').classList.add('hidden');cap('capText').value='';captureClearSaved();await captureDeleteDraft().catch(()=>{});captureOpenCamera();
}
function captureManual(){captureCancel();captureStopCamera();captureOrigin='manual';cap('capReview').classList.remove('hidden');cap('capText').focus();captureMessage('Enter Chinese text, then confirm it before saving.');captureQueueDraft();}
function captureCancel(){
  captureSession.invalidate();captureWorkerEpoch++;
  const worker=captureWorkerPromise;captureWorkerPromise=null;
  if(worker)worker.then(w=>w.terminate()).catch(()=>{});
  captureBusy(false);captureUpdateVerified();
}
function captureBusy(busy){if(!captureMounted)return;cap('capRecognize').disabled=busy||!captureCropBlob;cap('capCancel').classList.toggle('hidden',!busy);cap('capProgress').classList.toggle('hidden',!busy);cap('capText').disabled=busy;cap('capConfirm').disabled=busy;captureUpdateSave();}
async function captureGetWorker(token){
  if(!window.Tesseract)throw Error('OCR library did not load. Check your connection and reload; manual entry is still available.');
  if(!captureWorkerPromise){
    const epoch=captureWorkerEpoch;
    captureWorkerPromise=Tesseract.createWorker('chi_sim',1,{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim@1.0.0/4.0.0_best_int',logger:m=>{if(captureMounted&&captureSession.busy){cap('capProgress').value=m.progress||0;captureMessage((m.status==='recognizing text'?'Recognizing selected area':'Loading Chinese recognition')+'… '+Math.round((m.progress||0)*100)+'%');}}}).then(w=>{if(epoch!==captureWorkerEpoch){w.terminate().catch(()=>{});throw Error('Recognition cancelled.');}return w;}).catch(e=>{if(epoch===captureWorkerEpoch)captureWorkerPromise=null;throw e;});
  }
  return captureWorkerPromise;
}
async function captureRecognize(){
  if(!captureCropBlob||captureSession.busy)return;
  if(captureSession.text&&!confirm('Recognize this crop again? This replaces the current corrected text.'))return;
  captureSession.text='';captureSession.raw='';captureSelection=null;captureLastIndex=null;cap('capText').value='';captureUpdateVerified();captureClearSaved();
  const token=captureSession.begin(),blob=captureCropBlob,started=performance.now();captureBusy(true);captureMessage('Loading Chinese recognition…');
  captureDiagnostic={...captureDiagnostic,captureRevision:token.revision,job:token.job,engine:'Tesseract.js 5.1.1',language:'chi_sim',layout:cap('capLayout').value};
  const timeout=setTimeout(()=>{if(captureSession.current(token)&&captureMounted){captureCancel();captureMessage('Recognition timed out. Try a smaller crop, a clearer photograph, or manual entry.',true);}},90000);
  try{
    const worker=await captureGetWorker(token);if(!captureSession.current(token))return;
    await worker.setParameters({tessedit_pageseg_mode:cap('capLayout').value,preserve_interword_spaces:'1'});
    const result=await worker.recognize(blob);if(!captureMounted||!captureSession.apply(token,result.data))return;
    captureDiagnostic={...captureDiagnostic,elapsedMs:Math.round(performance.now()-started),confidence:result.data.confidence,raw:result.data.text,lines:result.data.lines?.map(l=>({text:l.text,confidence:l.confidence,bbox:l.bbox}))};captureDebug();
    cap('capReview').classList.remove('hidden');cap('capText').value=captureSession.text;
    if(!C.han(captureSession.text))captureMessage('No Chinese text recognized. Retry with a closer, clearer crop or enter the text manually.',true);
    else captureMessage((result.data.confidence<65?'Low-confidence result. ':'')+'Check every character against the crop and correct mistakes. Nothing has been saved.');
    captureQueueDraft();
  }catch(e){if(captureMounted&&captureSession.current(token)){captureSession.busy=false;captureSession.text='';cap('capText').value='';cap('capReview').classList.remove('hidden');captureMessage('Recognition failed. '+e.message+' Retry or enter text manually.',true);captureQueueDraft();}}
  finally{clearTimeout(timeout);if(captureSession.current(token)){captureSession.busy=false;captureBusy(false);}}
}
function captureDebug(){if(cap('capDebug'))cap('capDebug').textContent=JSON.stringify(captureDiagnostic,null,2);}

// Lightweight on-page pinyin correction: no keyboard switch and no remote request.
// A small common-character index complements the user's saved vocabulary.
// Candidates are suggestions, never automatically substituted into OCR text.
let captureCorrectionCursor={start:0,end:0};
const capturePinyinCommon={
'a':'啊阿','ai':'爱矮挨','an':'安按案','ba':'八把爸吧','bai':'白百摆','ban':'半班办','bao':'包报抱','bei':'北杯被','ben':'本奔','bi':'比笔必','bian':'边变便','bu':'不步部',
'cha':'茶查差','chang':'长常唱','che':'车','chi':'吃迟持','chu':'出初','chuan':'穿船','ci':'次词','cong':'从聪','cuo':'错',
'da':'大打答','dan':'但单蛋','dao':'到道刀','de':'的得地','deng':'等灯','di':'地第弟低','dian':'点电店','dong':'东动冬','dou':'都豆','du':'读度','dui':'对','duo':'多朵',
'er':'二儿耳','fa':'发法','fan':'饭反翻','fang':'方房放','fei':'飞非','fen':'分份','feng':'风','fu':'父复服福',
'gao':'高告','ge':'个哥歌','gei':'给','gen':'跟根','gong':'工公共','gou':'狗够','guo':'国过果',
'hai':'还海孩','han':'汉汗','hao':'好号','he':'和喝河','hen':'很','hou':'后','hua':'话花画','huan':'欢换','hui':'会回','huo':'火活',
'ji':'几机鸡记','jia':'家加假','jian':'见件间建','jiang':'讲江','jiao':'叫教角','jie':'姐接节','jin':'今进近','jing':'京经','jiu':'九久就','ju':'句',
'kai':'开','kan':'看','ke':'可课客','kou':'口','kuai':'快块','lai':'来','lan':'蓝','lao':'老','le':'了乐','lei':'累','li':'里理力','lian':'脸连','liang':'两亮','lin':'林','ling':'零','liu':'六流','long':'龙','lou':'楼','lu':'路录','lv':'绿',
'ma':'妈马吗','mai':'买卖','man':'慢满','mao':'猫毛','mei':'没美每','men':'们门','mi':'米','mian':'面','ming':'名明','mo':'末','mu':'木母目',
'na':'那拿','nai':'奶','nan':'男南难','ne':'呢','nei':'内','neng':'能','ni':'你','nian':'年','nin':'您','niu':'牛','nong':'农','nu':'努','nv':'女',
'pa':'怕爬','peng':'朋','pi':'皮','piao':'票','ping':'平苹','po':'破','qi':'七起气','qian':'前钱千','qiang':'强','qiao':'桥','qin':'亲','qing':'请清青','qiu':'秋球','qu':'去取',
'ran':'然','rang':'让','ren':'人认','ri':'日','rong':'容','rou':'肉','ru':'入如','san':'三','se':'色','sha':'沙','shan':'山','shang':'上商','shao':'少烧','she':'社','shen':'什身神','sheng':'生声','shi':'是十时事市师','shou':'手首','shu':'书树数','shui':'水谁睡','shuo':'说','si':'四思','song':'送','su':'素','sui':'岁',
'ta':'他她它','tai':'太台','tan':'谈','tang':'汤糖','tian':'天田甜','ting':'听停','tong':'同通','tou':'头','tu':'土图','tui':'推',
'wa':'娃','wai':'外','wan':'万晚完','wang':'王往忘','wei':'为位未','wen':'问文','wo':'我','wu':'午五无物武舞屋乌吴务',
'xi':'西洗喜习','xia':'下夏','xian':'先现线','xiang':'想向像','xiao':'小笑校','xie':'写些谢','xin':'新心','xing':'行星','xiong':'兄','xiu':'休','xu':'学需','xue':'学雪',
'ya':'呀牙','yan':'眼言','yang':'样羊','yao':'要药','ye':'也夜','yi':'一衣以意已医','yin':'音因','ying':'英应','yong':'用永','you':'有又友右','yu':'雨语鱼月','yuan':'元远园','yue':'月越',
'zai':'在再','zan':'咱','zao':'早','ze':'则','zen':'怎','zhan':'站','zhang':'张长','zhao':'找照','zhe':'这着','zhen':'真','zheng':'正整','zhi':'只知纸之','zhong':'中种重','zhou':'周州','zhu':'主住猪','zhuan':'转','zi':'子字自','zou':'走','zu':'足组','zuo':'做作坐左'
};
function capturePinyinKey(text){
  return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ü|v/g,'u').replace(/[1-5]/g,'').replace(/[^a-z]/g,'');
}
function captureRememberCursor(){
  const field=cap('capText');if(!field)return;
  captureCorrectionCursor={start:field.selectionStart,end:field.selectionEnd};
}
function captureOfferPinyin(){
  const input=cap('capPinyinCorrect'),root=cap('capPinyinChoices'),help=cap('capPinyinHelp');
  if(!input||!root)return;
  const key=capturePinyinKey(input.value);root.replaceChildren();
  if(!key){help.textContent='Type pinyin (tone marks or numbers optional), then choose a character.';return;}
  const candidates=[];
  function add(text){for(const ch of Array.from(String(text||''))){if(/[\u3400-\u9fff]/u.test(ch)&&!candidates.includes(ch))candidates.push(ch);}}
  add(capturePinyinCommon[key]||'');
  for(const entry of db.entries||[]){
    if(capturePinyinKey(entry.pinyin)===key)add(entry.simplified||entry.hanzi||'');
  }
  if(!candidates.length){help.textContent='No suggestion found for '+input.value+'. Try another spelling, or add the character with a Chinese keyboard.';return;}
  for(const ch of candidates.slice(0,32)){
    const button=document.createElement('button');button.type='button';button.textContent=ch;button.lang='zh-Hans';
    button.style.cssText='font-size:27px;min-width:46px;min-height:46px;padding:5px 10px;border:1px solid #cbd5c7;border-radius:9px;background:#f3faf0;color:#17251b';
    button.onclick=()=>captureInsertCorrection(ch);root.append(button);
  }
  help.textContent='Tap a candidate to replace the selected character or insert at the cursor. Confirm the corrected sentence afterward.';
}
function captureInsertCorrection(ch){
  const field=cap('capText');if(!field)return;
  const old=field.value;let {start,end}=captureCorrectionCursor;
  start=Math.max(0,Math.min(start,old.length));end=Math.max(start,Math.min(end,old.length));
  // A tap without selection corrects the character directly after the caret.
  // At end of text, insert a missing character instead.
  if(start===end&&start<old.length&&/[\u3400-\u9fff]/u.test(old[start]))end=start+1;
  field.value=old.slice(0,start)+ch+old.slice(end);
  const next=start+ch.length;field.focus();field.setSelectionRange(next,next);
  captureCorrectionCursor={start:next,end:next};
  captureSession.edit(field.value);captureSelection=null;captureLastIndex=null;captureUpdateVerified();captureQueueDraft();
  cap('capPinyinCorrect').value='';captureOfferPinyin();
}

function captureConfirm(){
  try{captureSession.edit(cap('capText').value.normalize('NFC').trim());captureSession.confirm();cap('capText').value=captureSession.text;captureSelection=null;captureLastIndex=null;captureUpdateVerified();captureQueueDraft();captureMessage('Text confirmed. Select the character, expression, or sentence to save.');}catch(e){captureMessage(e.message,true);}
}
function captureUpdateVerified(){
  if(!captureMounted)return;const yes=captureSession.verified;
  cap('capSavePanel').classList.toggle('hidden',!yes);cap('capVerified').textContent=yes?'Confirmed. Editing the text requires confirmation again.':'Not confirmed — saving is disabled.';
  if(yes)captureRenderTokens();captureUpdateSave();
}
function captureRenderTokens(){
  const root=cap('capTokens');root.replaceChildren();let offset=0;
  for(const char of captureSession.text){const start=offset;offset+=char.length;
    if(char==='\n'){root.append(document.createElement('br'));continue;}
    const button=document.createElement('button');button.type='button';button.textContent=char;button.lang='zh-Hans';button.dataset.start=start;button.dataset.end=offset;button.setAttribute('aria-label','Select '+char);
    button.onclick=e=>{if((e.shiftKey||captureRange)&&captureLastIndex!==null)captureSetSelection(Math.min(captureLastIndex,start),Math.max(captureLastIndex+([...captureSession.text.slice(captureLastIndex)][0]?.length||1),offset));else{captureLastIndex=start;captureSetSelection(start,offset);}};
    root.append(button);
  }

}
function captureHighlight(){const field=cap('capText');captureSetSelection(field.selectionStart,field.selectionEnd);}
function captureSetSelection(start,end){
  if(!captureSession.verified||start===end){captureMessage('Highlight or tap the Chinese text to save.',true);return;}
  const text=captureSession.text.slice(start,end);captureSelection={start,end,text};
  for(const b of cap('capTokens').querySelectorAll('button')){const selected=Number(b.dataset.start)>=start&&Number(b.dataset.end)<=end;b.classList.toggle('on',selected);b.setAttribute('aria-pressed',String(selected));}
  cap('capSelected').textContent='Selected: '+text;cap('capKind').value=[...text].length===1?'character':/[。！？\n]/u.test(text)?'sentence':'expression';
  const candidates=db.entries.filter(e=>C.normalize(e.simplified)===C.normalize(text)||C.normalize(e.traditional)===C.normalize(text));
  cap('capExisting').innerHTML=candidates.length?candidates.map(e=>`<option value="${captureEsc(e.id)}">${captureEsc(e.simplified+' · '+(e.pinyin||'reading missing')+' · '+(e.meaning||'meaning missing'))}</option>`).join(''):'<option value="">New dictionary entry</option>';
  cap('capLookup').textContent=candidates.length?'Existing entry will be reused. Its reading, meaning, and review history will be preserved.':'New entry: enter the reading and meaning if known. They can be left blank for later review.';
  captureFillEntry();captureUpdateSave();captureQueueDraft();
}
function captureFillEntry(){const e=db.entries.find(e=>e.id===cap('capExisting').value);for(const [id,key] of [['capPinyin','pinyin'],['capMeaning','meaning'],['capMeaningFr','meaning_fr']]){cap(id).value=e?.[key]||'';cap(id).readOnly=!!e;}captureUpdateSave();}
function captureUpdateSave(){if(cap('capSave'))cap('capSave').disabled=captureSaving||captureSession.busy||!captureSession.verified||!captureSelection||!C.han(captureSelection.text);}
async function captureNewLesson(){
  const title=prompt('Name the lesson, for example Le Petit Prince 1');if(!C.normalize(title))return;
  try{const next=JSON.parse(JSON.stringify(db)),id=captureId();next.lessons.unshift({id,title:C.normalize(title),kind:'book',source:C.normalize(title),items:[]});captureCommit(next);const o=document.createElement('option');o.value=id;o.textContent=C.normalize(title);cap('capLesson').prepend(o);cap('capLesson').value=id;captureQueueDraft();captureMessage('Lesson created. Select text and save it into this lesson.');}catch(e){captureMessage('Lesson was not saved: '+e.message,true);}
}
function captureCommit(next){
  if(storageLoadError)throw Error('Existing saved data could not be read. Export or restore it before saving.');
  const current=localStorage.getItem(KEY);
  if(current!==storageBaseline)throw Error('The dictionary changed in another tab. Export your draft, then reload before saving.');
  // A single localStorage replacement is atomic: vocabulary, source and lesson links commit together.
  const json=JSON.stringify(next);localStorage.setItem(KEY,json);storageBaseline=json;db=next;
}
async function captureSave(){
  if(captureSaving||!captureSession.verified||!captureSelection)return;captureSaving=true;captureUpdateSave();
  try{
    captureCollect();const result=C.saveVocabulary(db,{verified:captureSession.verified,text:captureSelection.text,surface:captureSession.text,start:captureSelection.start,end:captureSelection.end,kind:cap('capKind').value,existingId:cap('capExisting').value,pinyin:cap('capPinyin').value,meaning:cap('capMeaning').value,meaningFr:cap('capMeaningFr').value,translation:cap('capTranslation').value,sourcePinyin:cap('capSourcePinyin').value,sourceTitle:cap('capSource').value,note:cap('capNote').value,lessonId:cap('capLesson').value,origin:captureOrigin},captureId);
    captureCommit(result.next);captureMessage((result.existed?'Reused existing entry. ':'Saved new entry. ')+result.target.simplified+' — source text and lesson links saved on this device.');
    const button=document.createElement('button');button.textContent='Open saved entry';button.onclick=()=>{study=result.target.id;select('today');};cap('capSaved').replaceChildren(button);
    await capturePersistDraft().catch(()=>{});
  }catch(e){captureMessage('Not saved: '+e.message+'. Your corrected text is still here.',true);}
  finally{captureSaving=false;captureUpdateSave();}
}
function captureExport(){
  captureCollect();const data={format:'myCello-backup',version:1,exportedAt:new Date().toISOString(),database:db,captureDraft:{text:captureSession.text,verified:captureSession.verified,selection:captureSelection,form:captureForm}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='myCello-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function captureImport(file){
  if(!file)return;
  try{const backup=JSON.parse(await file.text());if(backup.format!=='myCello-backup'||backup.version!==1)throw Error('Unsupported backup format.');const next=C.validateDB(backup.database);
    if(!confirm('Restore this backup and replace the dictionary on this device? Export your current data first if you want to keep it.'))return;
    // Retain the previous bytes before an explicitly requested restore.
    const previous=localStorage.getItem(KEY);if(previous)localStorage.setItem(KEY+'-before-restore',previous);
    const json=JSON.stringify(next);localStorage.setItem(KEY,json);storageLoadError=null;storageBaseline=json;db=next;captureCollect();captureRender();captureMessage('Backup restored. Previous dictionary bytes were retained on this device.');
  }catch(e){captureMessage('Backup was not restored: '+e.message,true);}
}
function captureLeave(){
  if(!captureMounted)return;capturePersistDraft();captureMounted=false;captureStopCamera();captureCancel();capturePreviewEpoch++;
  if(capturePhotoURL)URL.revokeObjectURL(capturePhotoURL);if(captureCropURL)URL.revokeObjectURL(captureCropURL);capturePhotoURL='';captureCropURL='';captureCropBlob=null;
}
window.addEventListener('pagehide',()=>{if(captureMounted){capturePersistDraft();captureStopCamera();captureCancel();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&captureMounted){capturePersistDraft();captureStopCamera();captureCancel();}});

/* Pure Capture rules shared by the browser and regression tests. */
(function(root){
  'use strict';
  const normalize=text=>String(text||'').normalize('NFC').trim();
  const han=text=>/\p{Script=Han}/u.test(text);
  const chars=text=>[...new Set([...text].filter(han))];
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function cropPixels(crop,width,height){
    const x=clamp(Math.floor(crop.x*width),0,width-1),y=clamp(Math.floor(crop.y*height),0,height-1);
    return {x,y,width:clamp(Math.ceil((crop.x+crop.w)*width)-x,1,width-x),height:clamp(Math.ceil((crop.y+crop.h)*height)-y,1,height-y)};
  }
  function point(clientX,clientY,rect){return {x:clamp((clientX-rect.left)/rect.width,0,1),y:clamp((clientY-rect.top)/rect.height,0,1)};}
  function moveCrop(start,dx,dy,handle){
    if(handle==='move') return {...start,x:clamp(start.x+dx,0,1-start.w),y:clamp(start.y+dy,0,1-start.h)};
    let l=start.x,t=start.y,r=l+start.w,b=t+start.h;
    if(handle.includes('w')) l=clamp(l+dx,0,r-.03);
    if(handle.includes('e')) r=clamp(r+dx,l+.03,1);
    if(handle.includes('n')) t=clamp(t+dy,0,b-.03);
    if(handle.includes('s')) b=clamp(b+dy,t+.03,1);
    return {x:l,y:t,w:r-l,h:b-t};
  }
  function textScale(rows,width){
    const runs=[];let start=-1;
    // Detect horizontal print bands; scale down only clearly oversized text.
    for(let y=0;y<=rows.length;y++){
      const ink=y<rows.length&&rows[y]>=Math.max(2,width*.003);
      if(ink&&start<0) start=y;
      if(!ink&&start>=0){if(y-start>=8)runs.push(y-start);start=-1;}
    }
    if(!runs.length) return 1;
    runs.sort((a,b)=>a-b);const height=runs[Math.floor(runs.length/2)];
    return height>60?Math.max(.25,40/height):1;
  }
  class Session {
    constructor(){this.revision=0;this.job=0;this.raw='';this.text='';this.verified=false;this.busy=false;}
    invalidate(){this.revision++;this.job++;this.busy=false;this.verified=false;}
    clear(){this.invalidate();this.raw='';this.text='';}
    begin(){this.verified=false;this.busy=true;return {revision:this.revision,job:++this.job};}
    current(token){return token.revision===this.revision&&token.job===this.job;}
    apply(token,data){if(!this.current(token)) return false;this.raw=String(data.text||'');this.text=this.raw.normalize('NFC').replace(/\r\n?/g,'\n').trim();this.busy=false;return true;}
    edit(text){this.text=text;this.verified=false;}
    confirm(){if(!han(this.text)) throw Error('Enter Chinese text before confirming.');this.verified=true;}
  }
  function validateDB(data){
    if(!data||!Array.isArray(data.entries)||!Array.isArray(data.lessons)||!Array.isArray(data.examples)||!data.reviews||!data.palace) throw Error('This backup is not a complete Mandarin dictionary.');
    for(const e of data.entries) if(typeof e.id!=='string'||typeof e.simplified!=='string'||!e.id||!normalize(e.simplified)) throw Error('Invalid vocabulary record.');
    const ids=new Set(data.entries.map(e=>e.id));
    if(ids.size!==data.entries.length) throw Error('Duplicate vocabulary IDs.');
    for(const l of data.lessons) if(typeof l.id!=='string'||typeof l.title!=='string'||!Array.isArray(l.items)||l.items.some(id=>!ids.has(id))) throw Error('Invalid lesson links.');
    return data;
  }
  function saveVocabulary(database,input,id){
    if(!input.verified) throw Error('Confirm the corrected text first.');
    const text=normalize(input.text),surface=normalize(input.surface),kind=input.kind;
    if(!han(text)||!surface.includes(text)) throw Error('Select Chinese text from the confirmed source.');
    if(kind==='character'&&(!han(text)||[...text].length!==1)) throw Error('Select exactly one Chinese character.');
    if(!['character','expression','sentence'].includes(kind)) throw Error('Choose a save type.');
    const next=JSON.parse(JSON.stringify(database));
    const candidates=next.entries.filter(e=>normalize(e.simplified)===text||normalize(e.traditional)===text);
    let target=candidates.find(e=>e.id===input.existingId);
    if(!target&&candidates.length===1) target=candidates[0];
    if(!target&&candidates.length>1) throw Error('Choose the existing reading or meaning.');
    const existed=!!target;
    if(!target){
      target={id:id(),simplified:text,traditional:'',pinyin:normalize(input.pinyin),meaning:normalize(input.meaning),meaning_fr:normalize(input.meaningFr),sound:'',type:kind,status:'new',source:input.origin||'photo',srsEligible:false,practicePasses:0};
      next.entries.unshift(target);
    }
    // Reuse vocabulary and reviews while completing genuinely missing metadata.
    for(const [key,value] of [['pinyin',input.pinyin],['meaning',input.meaning],['meaning_fr',input.meaningFr]]){
      if(!normalize(target[key])&&normalize(value))target[key]=normalize(value);
    }
    target.dictionaryReview='pending';
    const lesson=next.lessons.find(l=>l.id===input.lessonId);
    if(input.lessonId&&!lesson) throw Error('That lesson no longer exists. Choose another.');
    if(lesson&&!lesson.items.includes(target.id)) lesson.items.push(target.id);
    const context={entryId:target.id,surface,selectedText:text,selectionStart:input.start,selectionEnd:input.end,meaning:normalize(input.translation),pinyin:normalize(input.sourcePinyin),source:normalize(input.sourceTitle),note:normalize(input.note),sourceType:input.origin||'photo'};
    const signature=x=>JSON.stringify([x.entryId,x.surface,x.selectedText,x.meaning,x.source,x.note]);
    if(!next.examples.some(e=>signature(e)===signature(context))) next.examples.unshift({id:id(),...context});
    return {next,target,existed};
  }
  function practice(database,id,good){
    const e=database.entries.find(x=>x.id===id); if(!e) return;
    // Legacy vocabulary keeps its established eligibility and review history.
    const old=database.lessonPractice?.[id]||{passes:0};
    old.passes=good?old.passes+1:0;
    database.lessonPractice=database.lessonPractice||{};database.lessonPractice[id]=old;
    if(e.srsEligible===false){e.practicePasses=old.passes;if(old.passes>=3){e.srsEligible=true;e.status='review';database.reviews[id]={strength:2.5,interval:1,streak:3,next:Date.now()+86400000};}}
  }
  function needsDictionaryReview(database,entry){
    if(!normalize(entry.pinyin)||!normalize(entry.meaning))return true;
    if(entry.dictionaryReview)return entry.dictionaryReview!=='reviewed';
    return database.examples.some(x=>x.entryId===entry.id&&['photo','manual'].includes(x.sourceType));
  }
  const api={normalize,han,chars,clamp,cropPixels,point,moveCrop,textScale,Session,validateDB,saveVocabulary,practice,needsDictionaryReview};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.CaptureCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);



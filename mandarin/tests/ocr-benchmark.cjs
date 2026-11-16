/* Real Tesseract WASM benchmark; no mocked engine or returned text. */
const {createWorker}=require('tesseract.js');const {PNG}=require('pngjs');const C=require('../capture-core.js');const {execFileSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
const root=__dirname,results=path.join(root,'results');fs.mkdirSync(results,{recursive:true});
execFileSync('python3',[path.join(root,'make-fixtures.py')]);
const expected={clear:'她今天非常',sentence:'她今天非常高兴。',multiline:'她今天非常高兴。\n我也很高兴。',pinyin:'她今天非常',dense:'她今天非常高兴。我们一起学习中文。\n这个故事很好看。',blank:'','no-chinese':'',poor:'她今天非常'};
const han=s=>[...String(s)].filter(c=>/\p{Script=Han}/u.test(c)).join('');
(async()=>{const options={cachePath:results};if(fs.existsSync(path.join(results,'chi_sim.traineddata.gz')))options.langPath=results;
 const worker=await createWorker('chi_sim',1,options),rows=[];
 try{for(const [name,text] of Object.entries(expected)){
 await worker.setParameters({tessedit_pageseg_mode:name==='clear'||name==='pinyin'?'7':'6',preserve_interword_spaces:'1'});
 // The selected crop excludes pinyin, exactly as the user controls in Capture.
 const source=path.join(results,'fixtures',name+'.png'),cropped=path.join(results,name+'-crop.png'),processed=path.join(results,name+'-ocr.png');
 execFileSync('python3',['-c',"from PIL import Image;import sys;Image.open(sys.argv[1]).crop((80,100,1300,450)).save(sys.argv[2])",source,cropped]);
 const image=PNG.sync.read(fs.readFileSync(cropped)),ink=new Uint32Array(image.height);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4;if((image.data[i]+image.data[i+1]+image.data[i+2])/3<160)ink[y]++;}
 const scale=C.textScale(ink,image.width);
 execFileSync('python3',['-c',"from PIL import Image;import sys;im=Image.open(sys.argv[1]);s=float(sys.argv[3]);im.resize((round(im.width*s),round(im.height*s)),Image.Resampling.BILINEAR).save(sys.argv[2])",cropped,processed,String(scale)]);
 const start=performance.now(),{data}=await worker.recognize(processed);
 const actual=han(data.text),wanted=han(text);rows.push({fixture:name,scale,expected:text,raw:data.text,confidence:data.confidence,elapsedMs:Math.round(performance.now()-start),hanExact:actual===wanted});console.log(name,JSON.stringify(data.text),data.confidence,actual===wanted?'exact Han':'REVIEW NEEDED');
 }}finally{await worker.terminate();}
 fs.writeFileSync(path.join(results,'ocr-benchmark.json'),JSON.stringify({engine:'Tesseract.js 5.1.1',language:'chi_sim',synthetic:true,rows},null,2));
 const required=['clear','sentence','multiline','pinyin','blank','no-chinese'];if(rows.some(r=>required.includes(r.fixture)&&!r.hanExact))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

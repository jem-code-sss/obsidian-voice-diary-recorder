const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {folderPath}=require('../src/helpers');
const NEW_KEY='voice-diary-recorder:settings',OLD_KEY='voice-diary-unified:mobile';
const toPlain=value=>JSON.parse(JSON.stringify(value));
function host(options={}){
  const notices=[],durations=[],requires=[],texts=[],buttons=[],commands=[],saved=[],loaded=[],files=new Map(),timers=[];
  const controls={writeFailure:false,writeThenReject:false,readMismatch:false,settingsFailure:false,permission:null,...options};
  let started=0,released=0,created=0,mediaStops=0;
  function element(tag,settings={}){
    return {tag,text:settings.text||'',attrs:{...settings.attr},removed:false,setText(value){this.text=value;},
      setAttribute(key,value){this.attrs[key]=value;},addClass(){},remove(){this.removed=true;},empty(){},
      classList:{toggle(){}},createEl:element};
  }
  function target(){const listeners=new Map();return{
    addEventListener(name,fn){const group=listeners.get(name)||new Set();group.add(fn);listeners.set(name,group);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
    dispatch(type){for(const fn of listeners.get(type)||[])fn({type});}
  };}
  class Plugin{
    constructor(app){this.app=app;this.domEvents=[];}
    addRibbonIcon(_icon,_title,callback){const ribbon=element('button');ribbon.onclick=callback;return ribbon;}
    addStatusBarItem(){return element('span');}addSettingTab(tab){this.settingTab=tab;}addCommand(command){commands.push(command);}
    registerDomEvent(object,name,fn){object.addEventListener(name,fn);this.domEvents.push([object,name,fn]);}
    registerInterval(){}
  }
  class Setting{
    setName(name){this.name=name;return this;}setDesc(){return this;}
    addText(callback){const input={setValue(value){this.value=value;return this;},onChange(change){this.change=change;return this;}};callback(input);texts.push({name:this.name,input});return this;}
    addButton(callback){const button={setButtonText(text){this.text=text;return this;},onClick(fn){this.fn=fn;return this;}};callback(button);buttons.push(button);return this;}
  }
  const track={stop(){released++;}};
  class MediaRecorder{
    static isTypeSupported(type){return type===(controls.mime||'audio/webm;codecs=opus');}
    constructor(_stream,config){this.mimeType=controls.unknownMime?'audio/unknown':config?.mimeType||'audio/webm';this.state='inactive';}
    start(){started++;this.state='recording';}
    requestData(){this.ondataavailable?.({data:new Blob([controls.audio||'synthetic microphone audio'])});}
    stop(){mediaStops++;this.state='inactive';if(!controls.delayStop)this.onstop?.();}
  }
  const vault={
    getAbstractFileByPath:name=>files.get(name),
    async createFolder(name){if(controls.folderFailure)throw Error('directory denied');const existing=files.get(name);if(existing)throw Error('exists');files.set(name,{path:name,children:[]});},
    async createBinary(name,bytes){created++;if(controls.writeFailure)throw Error('disk full');if(files.has(name))throw Error('exists');const file={path:name,name:name.split('/').pop(),data:bytes};files.set(name,file);if(controls.writeThenReject)throw Error('written, reply rejected');return file;},
    async readBinary(file){return controls.readMismatch?new Uint8Array([1]).buffer:file.data;}
  };
  const app={vault,
    loadLocalStorage(key){loaded.push(key);if(controls.loadFailure)throw Error('private path');return key===NEW_KEY?controls.settings:controls.old;},
    saveLocalStorage(key,data){if(controls.settingsFailure)throw Error('private path');saved.push({key,data:toPlain(data)});}
  };
  const document={...target(),visibilityState:'visible',body:{createEl:element}};
  const window={...target(),setInterval:()=>1};
  const obsidian={Plugin,PluginSettingTab:class{constructor(app){this.app=app;this.containerEl=element('div');}},Setting,
    Notice:class{constructor(message,duration){notices.push(message);durations.push(duration);}},
    Platform:{isMobileApp:controls.mobile!==false,isMobile:controls.mobile!==false},setIcon(element,icon){element.icon=icon;}};
  const ctx={module:{exports:{}},require(id){requires.push(id);if(id==='obsidian')return obsidian;throw Error('Forbidden runtime import '+id);},
    navigator:{mediaDevices:{async getUserMedia(){if(controls.permission)await controls.permission;return{getTracks:()=>[track]};}}},
    MediaRecorder,Blob,Date,Uint8Array,ArrayBuffer,crypto:webcrypto,document,window,
    setTimeout(callback){timers.push(callback);return timers.length;},clearTimeout(){},console};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/voice-diary-recorder/main.js'),'utf8'),ctx,{timeout:1000});
  const p=new ctx.module.exports(app);
  return {p,ctx,app,files,notices,durations,requires,texts,buttons,commands,saved,loaded,controls,track,timers,
    open:async()=>{await p.onload();return p;},counts:()=>({started,released,created,mediaStops})};
}
const audioFiles=h=>[...h.files.values()].filter(file=>file.data);
async function settle(p){await p.recordingStop;await p.saving;await Promise.resolve();}

test('compiled mobile plugin loads with obsidian as its only external runtime import',async()=>{
  const h=host();await h.open();assert.deepEqual(h.requires,['obsidian']);assert.equal(h.p.settings.folder,'Voice Diary/Recordings');
  assert.equal(h.commands.length,2);assert.ok(h.p.fab);assert.equal(h.p.domEvents.length,2);
  assert.deepEqual(h.saved,[{key:NEW_KEY,data:{folder:'Voice Diary/Recordings'}}]);
  h.p.onunload();await h.p.unloadTask;assert.equal(h.p.fab.removed,true);
});
test('all runtime source and compiled imports are browser compatible and do not contain network clients',()=>{
  const sources=fs.readdirSync(path.join(__dirname,'../src')).map(file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8')).join('\n');
  const bundle=fs.readFileSync(path.join(__dirname,'../dist/voice-diary-recorder/main.js'),'utf8');
  assert.ok(!/node:|require\(['"](?:electron|fs|path|os|http|https|child_process)['"]\)/.test(sources+bundle));
  assert.ok(!/requestUrl|fetch\(|XMLHttpRequest|WebSocket|SenseVoiceEngine/.test(sources+bundle));
  const imports=[...bundle.matchAll(/require\(["']([^"']+)["']\)/g)].map(match=>match[1]);assert.deepEqual(imports,['obsidian']);
  assert.deepEqual(fs.readdirSync(path.join(__dirname,'../dist/voice-diary-recorder')).sort(),['main.js','manifest.json','styles.css']);
});
test('first-use migration copies only a validated folder and does not touch previous storage',async()=>{
  const old={config:{folder:'个人 录音/片段',apiKey:'DO-NOT-COPY',model:'private'},jobs:{secret:'private text'}},before=JSON.stringify(old);
  const h=host({old});await h.open();assert.equal(h.p.settings.folder,'个人 录音/片段');assert.equal(JSON.stringify(old),before);
  assert.deepEqual(h.saved,[{key:NEW_KEY,data:{folder:'个人 录音/片段'}}]);assert.ok(!JSON.stringify(h.p.settings).includes('DO-NOT-COPY'));
  assert.ok(h.notices.some(message=>message.includes('电脑处理端')));assert.ok(!h.notices.join('').includes('private'));
});
test('existing new settings win and old mobile state is never read',async()=>{
  const h=host({settings:{folder:'已经保存/目录'},old:{config:{folder:'旧目录'}}});await h.open();
  assert.equal(h.p.settings.folder,'已经保存/目录');assert.deepEqual(h.loaded,[NEW_KEY]);assert.deepEqual(h.saved,[]);
});
test('invalid old folder is not imported and invalid existing settings are not overwritten',async()=>{
  let h=host({old:{config:{folder:'../private'}}});await h.open();assert.equal(h.p.settings.folder,'Voice Diary/Recordings');
  h=host({settings:{folder:'C:/private'},old:{config:{folder:'旧目录'}}});await h.open();assert.equal(h.p.settings.folder,'Voice Diary/Recordings');assert.deepEqual(h.loaded,[NEW_KEY]);assert.equal(h.saved.length,0);
});
test('browser MediaRecorder preserves MIME, saves one audio file, and releases microphone',async()=>{
  const h=host({mime:'audio/mp4'});await h.open();await h.p.toggleRecording();assert.equal(h.p.recorder.state,'recording');assert.ok(h.p.indicator.text.includes('录音'));
  await h.p.toggleRecording();await settle(h.p);assert.equal(h.p.recorder.state,'idle');assert.equal(h.p.pendingAudio,null);assert.equal(h.counts().released,1);
  assert.equal(audioFiles(h).length,1);assert.ok(audioFiles(h)[0].path.endsWith('.m4a'));assert.equal(new TextDecoder().decode(audioFiles(h)[0].data),'synthetic microphone audio');
  assert.equal(h.p.indicator.text,'');assert.equal(h.p.status.text,'语音录音');assert.ok(![...h.files.keys()].some(file=>file.endsWith('.md')));
});
test('repeated background events stop and save once, foreground return does not resume',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();h.ctx.document.visibilityState='hidden';h.ctx.document.dispatch('visibilitychange');h.ctx.window.dispatch('pagehide');
  await settle(h.p);assert.equal(h.counts().mediaStops,1);assert.equal(audioFiles(h).length,1);
  h.ctx.document.visibilityState='visible';h.ctx.document.dispatch('visibilitychange');assert.equal(h.counts().started,1);assert.equal(h.durations.at(-1),4000);assert.equal(h.p.indicator.text,'');
  await h.p.toggleRecording();assert.equal(h.counts().started,2);assert.equal(h.p.interruption,null);await h.p.stopRecording();
});
test('failed background save retains audio; next click retries without starting another recording',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();h.controls.writeFailure=true;
  h.ctx.document.visibilityState='hidden';h.ctx.document.dispatch('visibilitychange');await settle(h.p);
  assert.ok(h.p.pendingAudio);assert.ok(h.p.indicator.text.includes('待保存'));assert.equal(audioFiles(h).length,0);
  const firstPath=h.p.pendingAudio.path;h.controls.writeFailure=false;h.ctx.document.visibilityState='visible';await h.p.toggleRecording();
  assert.equal(h.p.pendingAudio,null);assert.equal(audioFiles(h).length,1);assert.equal(audioFiles(h)[0].path,firstPath);assert.equal(h.counts().started,1);
});
test('a write that succeeds before rejecting is verified without creating a duplicate',async()=>{
  const h=host({writeThenReject:true});await h.open();await h.p.toggleRecording();await h.p.toggleRecording();await settle(h.p);
  assert.equal(h.p.pendingAudio,null);assert.equal(h.counts().created,1);assert.equal(audioFiles(h).length,1);await h.p.saveRecording();assert.equal(h.counts().created,1);
});
test('concurrent save callers share one operation and keep the one pinned path',async()=>{
  const h=host();await h.open();h.p.pendingAudio={blob:new Blob(['synthetic']),ext:'webm'};
  const first=h.p.saveRecording(),second=h.p.saveRecording();assert.equal(first,second);await first;
  assert.equal(h.counts().created,1);assert.equal(audioFiles(h).length,1);
});
test('existing unrelated target is never overwritten and the pending recording survives',async()=>{
  const h=host();await h.open();const target='Voice Diary/Recordings/existing.webm',bytes=new TextEncoder().encode('keep').buffer;
  h.files.set(target,{path:target,name:'existing.webm',data:bytes});h.p.pendingAudio={path:target,blob:new Blob(['different audio']),ext:'webm'};
  await assert.rejects(h.p.saveRecording());assert.ok(h.p.pendingAudio);assert.equal(new TextDecoder().decode(h.files.get(target).data),'keep');assert.equal(h.counts().created,0);
});
test('verification mismatch retains pending bytes and retry checks the same file',async()=>{
  const h=host({readMismatch:true});await h.open();h.p.pendingAudio={blob:new Blob(['synthetic']),ext:'webm'};
  await assert.rejects(h.p.saveRecording());const target=h.p.pendingAudio.path;assert.ok(h.p.pendingAudio);
  h.controls.readMismatch=false;await h.p.saveRecording();assert.equal(h.p.pendingAudio,null);assert.equal(h.counts().created,1);assert.equal(audioFiles(h)[0].path,target);
});
test('background change during microphone permission cancels capture and releases the granted device',async()=>{
  let grant;const permission=new Promise(resolve=>{grant=resolve;});const h=host({permission});await h.open();
  const starting=h.p.toggleRecording();assert.equal(h.p.recorder.state,'starting');h.ctx.document.visibilityState='hidden';h.ctx.document.dispatch('visibilitychange');grant();await starting;
  assert.equal(h.p.recorder.state,'idle');assert.equal(h.counts().started,0);assert.equal(h.counts().released,1);assert.equal(audioFiles(h).length,0);
});
test('already hidden mobile app refuses to acquire a microphone',async()=>{
  const h=host();await h.open();h.ctx.document.visibilityState='hidden';await h.p.toggleRecording();assert.equal(h.counts().started,0);assert.ok(h.notices.at(-1).includes('前台'));
});
test('device mute ends current capture once and clears track event handlers',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();h.track.onmute();await settle(h.p);
  assert.equal(h.counts().mediaStops,1);assert.equal(h.track.onmute,null);assert.equal(h.track.onended,null);assert.equal(audioFiles(h).length,1);
  await h.p.interruptRecording('device');assert.equal(h.counts().started,1);
});
test('native error with inactive state waits for queued final data and stop instead of discarding a short recording',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();const media=h.p.recorder.media;
  media.state='inactive';media.onerror();
  assert.equal(h.p.recorder.state,'stopping');assert.equal(typeof media.ondataavailable,'function');
  media.ondataavailable({data:new Blob(['final buffered speech'])});media.onstop();await settle(h.p);
  assert.equal(audioFiles(h).length,1);assert.equal(new TextDecoder().decode(audioFiles(h)[0].data),'final buffered speech');assert.equal(h.counts().mediaStops,0);
});
test('a spontaneous native stop already delivered completes immediately without waiting for the fallback timer',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();const media=h.p.recorder.media;
  media.state='inactive';media.ondataavailable({data:new Blob(['native ended speech'])});media.onstop();
  assert.equal(h.p.recorder.state,'idle');await settle(h.p);assert.equal(audioFiles(h).length,1);assert.equal(h.counts().mediaStops,0);
});
test('an inactive recorder missing its final stop remains bounded and preserves late bytes as partial',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();const media=h.p.recorder.media;
  media.state='inactive';media.onerror();assert.equal(h.p.recorder.state,'stopping');
  media.ondataavailable({data:new Blob(['late bytes before fallback'])});h.timers.at(-1)();await settle(h.p);
  assert.equal(new TextDecoder().decode(audioFiles(h)[0].data),'late bytes before fallback');assert.ok(h.notices.some(message=>message.includes('末尾')));
});
test('stop timeout saves available bytes as partial and late old data cannot enter a new recording',async()=>{
  const h=host({delayStop:true});await h.open();await h.p.toggleRecording();const old=h.p.recorder.media;
  const stop=h.p.stopRecording();h.timers.at(-1)();await stop;await settle(h.p);assert.equal(audioFiles(h).length,1);assert.ok(h.notices.some(message=>message.includes('末尾')));assert.equal(old.ondataavailable,null);
  h.controls.delayStop=false;h.controls.audio='second recording';await h.p.toggleRecording();await h.p.toggleRecording();await settle(h.p);
  assert.equal(audioFiles(h).length,2);assert.equal(new TextDecoder().decode(audioFiles(h)[1].data),'second recording');
});
test('settings keep draft across redraw and only apply validated Chinese or spaced relative paths',async()=>{
  const h=host();await h.open();h.p.settingTab.display();const field=h.texts.at(-1).input;field.change('中文 录音/第二层');assert.equal(h.p.settings.folder,'Voice Diary/Recordings');
  h.p.settingTab.display();assert.equal(h.texts.at(-1).input.value,'中文 录音/第二层');await h.buttons.filter(button=>button.text==='应用').at(-1).fn();
  assert.equal(h.p.settings.folder,'中文 录音/第二层');assert.ok(h.files.get('中文 录音/第二层').children);assert.deepEqual(h.saved.at(-1),{key:NEW_KEY,data:{folder:'中文 录音/第二层'}});
});
test('recording and pending audio prevent folder changes',async()=>{
  const h=host();await h.open();await h.p.toggleRecording();await assert.rejects(h.p.applyFolder('新目录'),error=>error.code==='busy');
  h.controls.writeFailure=true;await h.p.stopRecording();await settle(h.p);assert.ok(h.p.pendingAudio);await assert.rejects(h.p.applyFolder('新目录'),error=>error.code==='busy');
});
test('failed settings persistence rolls back directory and preserves old files',async()=>{
  const h=host();await h.open();h.controls.settingsFailure=true;await assert.rejects(h.p.applyFolder('新目录'),error=>error.code==='settings');
  assert.equal(h.p.settings.folder,'Voice Diary/Recordings');assert.equal(h.saved.length,1);
});
test('directory traversal, absolute paths and paths occupied by files are rejected',async()=>{
  for(const value of ['../outside','/absolute','C:/absolute','a/../b','a//b','\\\\server\\share','a:b','a\u0000b'])assert.throws(()=>folderPath(value));
  assert.equal(folderPath(' 中文 目录\\下级/ '),'中文 目录/下级');
  const h=host();await h.open();h.files.set('占位',{path:'占位',data:new ArrayBuffer(1)});await assert.rejects(h.p.applyFolder('占位/子目录'));assert.equal(h.p.settings.folder,'Voice Diary/Recordings');
});
test('desktop can record but has no mobile floating button or foreground guards',async()=>{
  const h=host({mobile:false});await h.open();assert.equal(h.p.fab,undefined);assert.equal(h.p.domEvents.length,0);await h.p.toggleRecording();h.ctx.document.visibilityState='hidden';h.ctx.document.dispatch('visibilitychange');assert.equal(h.p.recorder.state,'recording');await h.p.stopRecording();
});
test('unloading cancels pending permissions and closes a live microphone with a best effort save',async()=>{
  let grant;let h=host({permission:new Promise(resolve=>{grant=resolve;})});await h.open();const starting=h.p.toggleRecording();h.p.onunload();grant();await starting;await h.p.unloadTask;assert.equal(h.counts().started,0);assert.equal(h.counts().released,1);
  h=host();await h.open();await h.p.toggleRecording();h.p.onunload();await h.p.unloadTask;await settle(h.p);assert.equal(h.counts().released,1);assert.equal(audioFiles(h).length,1);assert.equal(h.p.fab.removed,true);
});
test('permission denial and unknown MIME release resources without creating audio files',async()=>{
  let h=host();await h.open();h.ctx.navigator.mediaDevices.getUserMedia=async()=>{throw Error('private diagnostics');};await h.p.toggleRecording();assert.equal(h.p.recorder.state,'idle');assert.ok(!h.notices.join('').includes('private diagnostics'));
  h=host({unknownMime:true});await h.open();await h.p.toggleRecording();assert.equal(h.counts().released,1);assert.equal(h.p.recorder.state,'idle');assert.equal(audioFiles(h).length,0);
});

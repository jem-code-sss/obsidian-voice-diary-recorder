const {Plugin,PluginSettingTab,Setting,Notice,Platform,setIcon}=require('obsidian');
const {AudioRecorder}=require('./recorder');
const {DEFAULT_FOLDER,DiaryError,safeMessage,folderPath,ensureFolder,recordingName,equalBytes}=require('./helpers');
const SETTINGS_KEY='voice-diary-recorder:settings';
const INTERRUPTION={background:'切后台或锁屏',muted:'麦克风暂时无法收声',paused:'录音被系统暂停',device:'录音设备中断'};
module.exports=class VoiceDiaryRecorder extends Plugin{
  async onload(){
    this.closed=false;this.mobile=Platform.isMobileApp||Platform.isMobile;this.settings={folder:DEFAULT_FOLDER};
    let stored;
    try{stored=this.app.loadLocalStorage(SETTINGS_KEY);}catch{new Notice('本机录音设置无法读取，当前使用默认目录；请检查并应用录音目录',10000);stored={};}
    if(stored!==null&&stored!==undefined){
      try{this.settings.folder=folderPath(stored.folder);}catch{new Notice('已保存的录音目录无效，当前使用默认目录；请检查并应用目录',10000);}
    }else{
      let migrated=false;
      try{
        const previous=this.app.loadLocalStorage('voice-diary-unified:mobile');
        if(previous?.config?.folder){this.settings.folder=folderPath(previous.config.folder);migrated=true;}
      }catch{}
      try{await this.persist();}catch{new Notice('录音目录尚未保存到本机，请在设置中重新应用目录',10000);}
      if(migrated)new Notice('已沿用旧版录音目录；请确保和电脑处理端的录音目录一致。未迁移其他数据',10000);
    }
    this.recorder=new AudioRecorder(reason=>void this.interruptRecording(reason));
    this.addSettingTab(new RecorderSettings(this.app,this));
    this.ribbon=this.addRibbonIcon('mic','语音录音：开始／停止',()=>void this.toggleRecording());
    this.status=this.addStatusBarItem();this.status.addClass('vdr-status');this.status.onclick=()=>void this.toggleRecording();
    if(this.mobile){
      this.fab=document.body.createEl('button',{cls:'vdr-mic',attr:{type:'button','aria-label':'开始录音'}});
      this.fab.onclick=()=>void this.toggleRecording();
      this.indicator=document.body.createEl('div',{cls:'vdr-indicator',attr:{'aria-live':'polite'}});
      this.registerDomEvent(document,'visibilitychange',()=>{
        if(document.visibilityState==='hidden')void this.interruptRecording('background');else this.showInterruption();
      });
      this.registerDomEvent(window,'pagehide',()=>void this.interruptRecording('background'));
    }
    this.addCommand({id:'record',name:'开始／停止录音',callback:()=>void this.toggleRecording()});
    this.addCommand({id:'save-recording',name:'重试保存录音',callback:()=>void this.saveRecording().catch(error=>new Notice(safeMessage(error),10000))});
    this.registerInterval(window.setInterval(()=>this.updateStatus(),1000));this.updateStatus();
  }
  persist(){return Promise.resolve(this.app.saveLocalStorage(SETTINGS_KEY,{folder:this.settings.folder}));}
  applyFolder(value){
    if(this.folderTask)return Promise.reject(new DiaryError('busy','正在应用录音目录，请稍候'));
    const task=this.commitFolder(value);this.folderTask=task;
    void task.then(()=>{if(this.folderTask===task)this.folderTask=null;},()=>{if(this.folderTask===task)this.folderTask=null;});
    return task;
  }
  async commitFolder(value){
    if(this.closed)throw new DiaryError('closed','录音插件已关闭');
    if(this.recordingBusy||this.recordingStop||this.saving||this.pendingAudio||this.recorder.state!=='idle')
      throw new DiaryError('busy','请先结束并保存当前录音，再更改目录');
    const next=folderPath(value),previous=this.settings.folder;
    await ensureFolder(this.app.vault,next);
    if(this.closed)throw new DiaryError('closed','录音插件已关闭，目录未应用');
    this.settings.folder=next;
    try{await this.persist();}catch(error){this.settings.folder=previous;throw new DiaryError('settings','录音目录保存失败，仍使用原目录，请检查本机存储');}
    new Notice('录音目录已应用；请确保手机和电脑处理端使用相同目录',6000);return next;
  }
  async toggleRecording(){
    if(this.closed||this.recordingBusy||this.recordingStop||this.saving)return;
    if(this.folderTask){new Notice('正在应用录音目录，请稍候再开始');return;}
    this.recordingBusy=true;
    try{
      if(this.recorder.state==='recording')await this.stopRecording();
      else if(this.pendingAudio)await this.saveRecording();
      else{
        if(this.mobile&&document.visibilityState==='hidden')throw new DiaryError('background','请回到 Obsidian 前台再开始录音');
        this.recordFolder=folderPath(this.settings.folder);this.interruption=null;this.interruptionShown=false;
        const starting=this.recorder.start();this.updateStatus();await starting;
        if(this.closed||this.mobile&&document.visibilityState==='hidden')await this.interruptRecording('background');
        if(!this.closed&&this.recorder.state==='recording')new Notice('录音开始，再次点击麦克风即可保存；手机请保持前台',4000);
      }
    }catch(error){new Notice(safeMessage(error),10000);}
    finally{this.recordingBusy=false;this.updateStatus();}
  }
  async interruptRecording(reason='device'){
    if(!this.recorder||!['starting','recording','stopping'].includes(this.recorder.state))return;
    this.interruption||=INTERRUPTION[reason]||INTERRUPTION.device;
    if(this.recorder.state==='starting'){this.recorder.cancelled=true;this.updateStatus();return;}
    await this.stopRecording(this.interruption);
  }
  stopRecording(interruption=null){
    if(this.recordingStop)return this.recordingStop;
    if(this.recorder.state!=='recording')return Promise.resolve();
    this.recordingBusy=true;
    const task=(async()=>{
      try{
        const stopped=this.recorder.stop();this.updateStatus();const pending=await stopped;
        if(!pending){new Notice('没有收到音频，请检查麦克风',4000);return;}
        if(interruption)pending.interruption=interruption;
        this.pendingAudio=pending;await this.saveRecording();
      }catch(error){new Notice(safeMessage(error),10000);}
      finally{this.recordingBusy=false;this.updateStatus();}
    })();
    this.recordingStop=task;
    void task.then(()=>{if(this.recordingStop===task)this.recordingStop=null;this.updateStatus();},()=>{if(this.recordingStop===task)this.recordingStop=null;this.updateStatus();});return task;
  }
  saveRecording(){
    if(this.saving)return this.saving;
    if(!this.pendingAudio)return Promise.resolve();
    const task=this.commitRecording();this.saving=task;
    void task.then(()=>{if(this.saving===task)this.saving=null;this.updateStatus();},()=>{if(this.saving===task)this.saving=null;this.updateStatus();});return task;
  }
  async commitRecording(){
    const pending=this.pendingAudio;
    try{
      const folder=await ensureFolder(this.app.vault,this.recordFolder||this.settings.folder);
      const bytes=await pending.blob.arrayBuffer();
      if(!bytes.byteLength)throw new DiaryError('empty','录音为空，请检查麦克风');
      pending.path||=`${folder}/${recordingName(pending.ext)}`;
      let file=this.app.vault.getAbstractFileByPath(pending.path);
      if(!file){
        try{file=await this.app.vault.createBinary(pending.path,bytes);}
        catch(error){file=this.app.vault.getAbstractFileByPath(pending.path);if(!file)throw error;}
      }
      if(Array.isArray(file.children)||!equalBytes(await this.app.vault.readBinary(file),bytes))
        throw new DiaryError('save','目标文件已存在或保存校验失败，录音仍在内存；请保留窗口并重试');
      if(this.pendingAudio===pending)this.pendingAudio=null;
      new Notice(`录音已保存${pending.interruption?`；${pending.interruption}，本段已结束`:''}${pending.partial?'；末尾可能不完整':''}`,4000);
    }catch(error){
      new Notice('录音尚未保存，音频仍在内存。请检查目录权限并重试保存，暂勿退出 Obsidian',12000);throw error;
    }
  }
  showInterruption(){
    if(!this.interruption||this.interruptionShown)return;
    this.interruptionShown=true;
    const state=this.pendingAudio?'音频待保存，请点击重试':this.recordingStop?'正在保存本段音频':'录音已结束，点击麦克风可再录一段';
    new Notice(`${this.interruption}：${state}`,4000);this.updateStatus();
  }
  updateStatus(){
    if(!this.recorder)return;
    const recording=this.recorder.state==='recording',seconds=recording?Math.max(0,Math.floor((Date.now()-this.recorder.startedAt)/1000)):0;
    const label=recording?`录音 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} · 点击保存`:
      this.pendingAudio?'录音待保存 · 点击重试':this.recorder.state==='starting'?'正在请求麦克风…':this.recordingBusy||this.recordingStop||this.saving?'正在保存录音…':'语音录音';
    this.status?.setText(label);
    for(const button of [this.ribbon,this.fab])if(button){setIcon(button,recording?'square':'mic');button.setAttribute('aria-label',label);}
    this.fab?.classList.toggle('is-recording',recording);
    this.indicator?.setText(recording||this.pendingAudio||this.recordingBusy||this.saving?label:'');
  }
  onunload(){
    this.closed=true;this.fab?.remove();this.indicator?.remove();
    if(!this.recorder)return;
    this.recorder.cancelled=true;
    this.unloadTask=(async()=>{
      if(this.recorder.state==='recording')await this.stopRecording('录音插件已关闭');
      else if(this.recordingStop)await this.recordingStop;
      if(this.pendingAudio)await this.saveRecording();
    })();
    void this.unloadTask.catch(()=>new Notice('退出时录音尚未保存，请保留窗口并检查存储',12000));
  }
};
class RecorderSettings extends PluginSettingTab{
  constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
  display(){
    const p=this.plugin,c=this.containerEl;c.empty();
    c.createEl('h2',{text:'Voice Diary Recorder'});
    c.createEl('p',{text:'只录音并保存原始音频，无需 Python、识别模型或 API。通过仓库同步交给电脑处理端转写。'});
    let draft=this.draft??p.settings.folder,input;
    new Setting(c).setName('录音保存目录').setDesc('仓库内相对目录，默认 Voice Diary/Recordings。请和电脑处理端设置一致，输入后点击应用。')
      .addText(text=>{input=text;text.setValue(draft).onChange(value=>{draft=value;this.draft=value;});})
      .addButton(button=>button.setButtonText('应用').onClick(async()=>{try{draft=await p.applyFolder(draft);delete this.draft;input.setValue(draft);}catch(error){new Notice(safeMessage(error),10000);}}));
    new Setting(c).setName('录音待保存').setDesc(p.pendingAudio?'音频仍在内存，退出前请重试保存。':'停止录音后自动保存原始音频。')
      .addButton(button=>button.setButtonText('重试保存录音').onClick(()=>void p.saveRecording().catch(error=>new Notice(safeMessage(error),10000))));
    c.createEl('p',{text:'手机录音请保持 Obsidian 在前台。切后台、锁屏或麦克风中断时结束本段并尝试保存；返回后需重新开始。系统冻结或强杀时可能来不及保存，不支持后台持续收音。'});
    c.createEl('p',{text:'可使用 Syncthing、Obsidian Sync 或其他仓库同步工具。插件本身不提供同步；请等待录音保存成功再离开应用。录音目录只保存在本设备。'});
  }
}

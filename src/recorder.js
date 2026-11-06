const {DiaryError}=require('./helpers');
const {capturedTime}=require('./capture');
const MIME_TYPES=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
function extension(mime){
  if(/mp4/i.test(mime))return 'm4a';
  if(/webm/i.test(mime))return 'webm';
  if(/ogg/i.test(mime))return 'ogg';
  if(/wav/i.test(mime))return 'wav';
  throw new DiaryError('mime','浏览器返回了不支持的音频格式，请使用支持录音的 Obsidian 设备');
}
class AudioRecorder{
  constructor(interrupted=()=>{}){this.interrupted=interrupted;this.state='idle';}
  async start(mode='diary'){
    if(this.state!=='idle')return;
    if(!globalThis.navigator?.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)
      throw new DiaryError('microphone','此设备不支持录音，请检查 Obsidian 的麦克风权限');
    this.cancelled=false;this.state='starting';
    try{
      this.stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(this.cancelled){this.release();this.state='idle';return;}
      const mime=MIME_TYPES.find(type=>MediaRecorder.isTypeSupported(type));
      const chunks=[];this.chunks=chunks;this.media=mime?new MediaRecorder(this.stream,{mimeType:mime}):new MediaRecorder(this.stream);
      this.mime=this.media.mimeType||mime||'';extension(this.mime);
      const session={media:this.media,chunks,mime:this.mime,stopSeen:false};this.session=session;
      const current=()=>this.session===session;
      this.media.ondataavailable=event=>{if(current()&&event.data?.size)chunks.push(event.data);};
      const interrupt=reason=>{if(current()&&this.state==='recording')this.interrupted(reason);};
      this.media.onerror=()=>interrupt('device');this.media.onpause=()=>interrupt('paused');
      this.media.onstop=()=>{if(current()){session.stopSeen=true;interrupt('device');}};
      for(const track of this.stream.getTracks()){
        track.onended=()=>interrupt('device');track.onmute=()=>interrupt('muted');
      }
      session.capture=capturedTime(Date.now());session.mode=mode==='todo'?'todo':'diary';
      this.media.start(500);this.startedAt=session.capture.recordedAt;this.state='recording';
    }catch(error){this.release();this.state='idle';throw error instanceof DiaryError?error:new DiaryError('microphone','无法开始录音，请检查麦克风权限和设备');}
  }
  async stop(){
    if(this.state!=='recording')return null;
    this.state='stopping';const session=this.session,media=session.media;
    return new Promise(resolve=>{
      let settled=false,timer;
      const finish=partial=>{
        if(settled||this.session!==session)return;settled=true;globalThis.clearTimeout(timer);
        const blob=new Blob(session.chunks,{type:session.mime});
        this.release();this.chunks=[];this.state='idle';
        resolve(blob.size?{blob,ext:extension(session.mime),partial,mode:session.mode,...session.capture}:null);
      };
      media.onstop=()=>{session.stopSeen=true;finish(false);};
      timer=globalThis.setTimeout(()=>finish(true),4000);
      // Native errors mark the recorder inactive before final dataavailable/stop
      // are dispatched. Keep the data handler until stop, or the bounded fallback.
      if(session.stopSeen)finish(false);
      else if(media.state!=='inactive'){
        try{media.requestData?.();}catch{}
        try{media.stop();}catch{} // A final event may already be queued.
      }
    });
  }
  release(){
    this.session=null;
    for(const track of this.stream?.getTracks()||[]){track.onended=null;track.onmute=null;track.stop();}
    if(this.media)for(const event of ['ondataavailable','onstop','onpause','onerror'])this.media[event]=null;
    this.stream=null;
  }
}
module.exports={AudioRecorder,extension};

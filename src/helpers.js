const DEFAULT_FOLDER='Voice Diary/Recordings';
class DiaryError extends Error {constructor(code,message){super(message);this.code=code;}}
const safeMessage=error=>error instanceof DiaryError?error.message:'操作未完成，请检查麦克风权限、存储空间和目录权限；录音保留待重试';
function folderPath(value){
  const folder=typeof value==='string'?value.trim().replace(/\\/g,'/').replace(/\/+$/,''):'';
  if(!folder||folder.startsWith('/')||/[\x00-\x1f\[\]#:*?"<>|]/.test(folder)||folder.split('/').some(segment=>!segment||segment==='.'||segment==='..'))
    throw new DiaryError('folder','录音目录须为仓库内的相对目录，例如 Voice Diary/Recordings');
  return folder;
}
async function ensureFolder(vault,value){
  const folder=folderPath(value);let current='';
  for(const segment of folder.split('/')){
    current=current?current+'/'+segment:segment;
    let existing=vault.getAbstractFileByPath(current);
    if(!existing){
      try{await vault.createFolder(current);}catch(error){if(!vault.getAbstractFileByPath(current))throw error;}
      existing=vault.getAbstractFileByPath(current);
    }
    if(!existing||!Array.isArray(existing.children))throw new DiaryError('folder','录音目录被文件占用或无法创建，请选择其他仓库内目录');
  }
  return folder;
}
function recordingName(extension){
  if(!/^(m4a|webm|ogg|wav)$/.test(extension))throw new DiaryError('mime','录音格式不受支持，音频仍在内存');
  const id=globalThis.crypto.randomUUID();
  const now=new Date(),pad=n=>String(n).padStart(2,'0');
  return `voice-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${id}.${extension}`;
}
function equalBytes(left,right){
  const a=new Uint8Array(left),b=new Uint8Array(right);
  return a.length===b.length&&a.every((value,index)=>value===b[index]);
}
module.exports={DEFAULT_FOLDER,DiaryError,safeMessage,folderPath,ensureFolder,recordingName,equalBytes};

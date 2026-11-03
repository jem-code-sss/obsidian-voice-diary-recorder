import {build} from 'esbuild';
import {copyFile,mkdir,realpath,lstat,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const dist=path.resolve(root,'dist');await mkdir(dist,{recursive:true});
const realRoot=await realpath(root);
if(await realpath(dist)!==path.join(realRoot,'dist'))throw Error('Build output must stay inside the project');
const output=path.join(dist,'voice-diary-recorder');
const previous=await lstat(output).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
if(previous?.isSymbolicLink())throw Error('Refusing a linked build output');
if(path.dirname(output)!==dist||path.basename(output)!=='voice-diary-recorder')throw Error('Unexpected build output');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await build({entryPoints:['src/main.js'],outfile:path.join(output,'main.js'),bundle:true,platform:'browser',format:'cjs',target:'es2020',external:['obsidian'],logLevel:'info',
  banner:{js:'/* Voice Diary Recorder. Copyright 2026 Voice Diary Unified contributors. MIT License. */'}});
for(const file of ['manifest.json','styles.css'])await copyFile(file,path.join(output,file));

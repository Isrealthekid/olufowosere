import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{for(const line of(await readFile(resolve(root,'.env'),'utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim();}}catch(e){if(e.code!=='ENOENT')throw e;}
if(!process.env.ADMIN_PASSWORD)throw new Error('Set ADMIN_PASSWORD in .env.');
const chats=process.env.CHAT_DATA_FILE||resolve(root,'data/chats.json');
const settings=resolve(dirname(chats),'settings.json');
const privateFile=resolve(dirname(chats),'private-state.json');
let privateState;try{privateState=JSON.parse(await readFile(privateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;privateState={};}
async function atomic(path,value){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);}
const store={
  async get(key){if(key==='chats'||key==='settings'){try{return JSON.parse(await readFile(key==='chats'?chats:settings,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return undefined;}}return structuredClone(privateState[key]);},
  async put(key,value){if(key==='chats'||key==='settings')return atomic(key==='chats'?chats:settings,value);const next={...privateState,[key]:value};await atomic(privateFile,next);privateState=next;}
};
let queue=Promise.resolve();
const publicDir=resolve(root,'dist');
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https://*.googleusercontent.com https://lh3.google.com; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src https://maps.google.com https://www.google.com https://drive.google.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname.startsWith('/api/')){
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
      const run=queue.then(()=>handleApi(request,process.env,store,req.socket.remoteAddress));queue=run.catch(()=>{});
      const response=await run;res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const requested=url.pathname==='/'?'index.html':['/admins','/admins/'].includes(url.pathname)?'admins.html':decodeURIComponent(url.pathname).slice(1);
    const file=resolve(publicDir,requested);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
    if(!file.startsWith(publicDir+sep)||requested.split(/[\\/]/).some(v=>v.startsWith('.'))||!types[extname(file)]){res.writeHead(404);res.end();return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code==='ENOENT'?'Not found.':'Could not complete the request.'}));}
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`Portfolio: http://localhost:${server.address().port}\nAdmin: http://localhost:${server.address().port}/admins`));


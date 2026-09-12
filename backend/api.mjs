import seedChats from '../dist/published-chats.js';
import seedSettings from '../dist/published-settings.js';
import { listPhotos } from './photos.mjs';
const encoder = new TextEncoder();
const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const reply = (status, value, headers = {}) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail = (message, status=400) => { throw Object.assign(new Error(message),{status}); };
function text(value, max, empty=false) { return typeof value==='string' && value.length<=max && (empty || !!value.trim()); }
function url(value, empty=true) { if(empty && value==='')return true;try{const parsed=new URL(value);return parsed.protocol==='https:' && !parsed.username && !parsed.password && value.length<=2000;}catch{return false;} }
function folder(value){if(value==='')return true;try{const u=new URL(value);return u.hostname==='drive.google.com' && u.protocol==='https:' && /\/folders\/[\w-]+/.test(u.pathname);}catch{return false;} }
function date(value) { if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value))return false;const full=value.length===7?value+'-01':value;const d=new Date(full+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===full; }
export function validChats(data) {
  const ids=new Set();
  return data && Number.isInteger(data.revision) && Array.isArray(data.groups) && data.groups.length<=100 && data.groups.every(g=>{
    if(!g || !text(g.id,80) || !/^[\w-]+$/.test(g.id) || ids.has(g.id) || !date(g.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(g.time||''))return false;
    ids.add(g.id);return Array.isArray(g.messages) && g.messages.length>0 && g.messages.length<=30 && g.messages.every(m=>m&&text(m.text,3000)&&text(m.reaction,32,true)&&['none','fade','bounce','pulse','wave'].includes(m.animation));
  });
}
export function validSettings(s) {
  return s && Number.isInteger(s.revision) && folder(s.driveFolder) && url(s.githubUrl) && url(s.cvUrl) && text(s.cvTitle,150) && text(s.contactPrompt,1000) && text(s.contactPlaceholder,100) && typeof s.contactEnabled==='boolean' && Array.isArray(s.websites) && s.websites.length<=30 && s.websites.every(w=>w&&text(w.title,150)&&url(w.url,false));
}
async function readBody(request) {
  const reader=request.body?.getReader();if(!reader)fail('Request body is required.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();fail('Request too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid JSON.');}
}
// The caller serializes requests for atomic revisions and inbox writes.
export async function handleApi(request, env, store, address='local') {
  try {
    const u=new URL(request.url), path=u.pathname, method=request.method;
    if(['POST','PUT','DELETE'].includes(method)){
      if(request.headers.get('Origin')!==u.origin || request.headers.get('Sec-Fetch-Site')==='cross-site')fail('Request origin is not allowed.',403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('JSON is required.',415);
    }
    const inputBody=['POST','PUT','DELETE'].includes(method)?await readBody(request):null;
    const settings = async () => (await store.get('settings')) || structuredClone(seedSettings);
    const chats = async () => (await store.get('chats')) || structuredClone(seedChats);
    if(path==='/api/photos' && method==='GET'){
      const config=await settings();
      return reply(200,{photos:config.driveFolder?await listPhotos(config,env,store):[]});
    }
    const now=Date.now();
    const cookieToken=request.headers.get('Cookie')?.match(/(?:^|;\s*)portfolio_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const sessions=(await store.get('sessions'))||{};
    for(const key of Object.keys(sessions))if(sessions[key].expires<=now)delete sessions[key];
    const sessionKey=cookieToken?await hash(cookieToken):'';
    const authenticated=!!(sessions[sessionKey] && env.ADMIN_PASSWORD && sessions[sessionKey].passwordHash===await hash(env.ADMIN_PASSWORD));
    const requireAdmin=()=>{if(!authenticated)fail('Please sign in again. Your unsaved edits are still here.',401);};
    const cookie=(token,age)=>`portfolio_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${u.protocol==='https:'?'; Secure':''}`;
    async function limit(kind,max,windowMs){
      const records=(await store.get('limits'))||{};for(const key of Object.keys(records))if(records[key].until<=now)delete records[key];
      const key=await hash(`${kind}:${address}`);const record=records[key]||{count:0,until:now+windowMs};
      if(!records[key]&&Object.keys(records).length>=1000)fail('Please try again later.',429);
      if(record.count>=max)fail('Too many attempts. Please try again later.',429);
      record.count++;records[key]=record;await store.put('limits',records);
    }
    if(path==='/api/session' && method==='GET')return reply(200,{authenticated});
    if(path==='/api/login' && method==='POST'){
      if(!env.ADMIN_PASSWORD)fail('Admin password has not been configured.',503);
      await limit('login',10,60000);const input=inputBody;
      const supplied=await hash(typeof input?.password==='string'?input.password:'');const expected=await hash(env.ADMIN_PASSWORD);
      let diff=0;for(let i=0;i<expected.length;i++)diff|=supplied.charCodeAt(i)^expected.charCodeAt(i);
      if(diff)fail('Incorrect password.',401);
      const token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(Object.keys(sessions).length>=100)delete sessions[Object.keys(sessions)[0]];
      sessions[await hash(token)]={expires:now+28800000,passwordHash:expected};await store.put('sessions',sessions);
      return reply(200,{ok:true},{'Set-Cookie':cookie(token,28800)});
    }
    if(path==='/api/logout' && method==='POST'){delete sessions[sessionKey];await store.put('sessions',sessions);return reply(200,{ok:true},{'Set-Cookie':cookie('',0)});}
    if(path==='/api/chats' && method==='GET')return reply(200,await chats());
    if(path==='/api/settings' && method==='GET')return reply(200,await settings());
    if((path==='/api/chats'||path==='/api/settings') && method==='PUT'){
      requireAdmin();const input=inputBody;const isChats=path==='/api/chats';
      if(!(isChats?validChats(input):validSettings(input)))fail('Check all fields, dates, times, and links. Use HTTPS links and a Google Drive folder URL.');
      const current=await(isChats?chats():settings());if(current.revision!==input.revision)fail('Changed in another session. Reload before saving.',409);
      const saved=isChats?{revision:current.revision+1,groups:input.groups.map(g=>({id:g.id,date:g.date,time:g.time,messages:g.messages.map(m=>({text:m.text.trim(),reaction:m.reaction.trim(),animation:m.animation}))})).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))}:{revision:current.revision+1,driveFolder:input.driveFolder,githubUrl:input.githubUrl,websites:input.websites.map(w=>({title:w.title.trim(),url:w.url})),cvUrl:input.cvUrl,cvTitle:input.cvTitle.trim(),contactPrompt:input.contactPrompt.trim(),contactPlaceholder:input.contactPlaceholder.trim(),contactEnabled:input.contactEnabled};
      await store.put(isChats?'chats':'settings',saved);return reply(200,saved);
    }
    if(path==='/api/contacts' && method==='POST'){
      if(!(await settings()).contactEnabled)fail('Contact replies are currently closed.',403);
      const input=inputBody;
      if(input?.website)fail('Could not send this reply.');
      if(!text(input?.contact,1000)||input.contact.trim().length<3||!text(input?.id,80)||!/^[\w-]+$/.test(input.id))fail('Enter an email, phone number, or social handle.');
      const items=(await store.get('contacts'))||[];
      const existing=items.find(item=>item.id===input.id);
      if(existing){if(existing.contact!==input.contact.trim())fail('Please retry with a new message.',409);return reply(200,{ok:true,id:existing.id,receivedAt:existing.receivedAt});}
      await limit('contact',5,3600000);
      if(items.length>=500)fail('The inbox is full. Please use the profile email instead.',503);
      const item={id:input.id,contact:input.contact.trim(),receivedAt:new Date(now).toISOString(),openedAt:typeof input.openedAt==='string' && !isNaN(Date.parse(input.openedAt))?new Date(input.openedAt).toISOString():null};
      items.unshift(item);await store.put('contacts',items);return reply(201,{ok:true,id:item.id,receivedAt:item.receivedAt});
    }
    if(path==='/api/contacts' && method==='GET'){requireAdmin();return reply(200,{items:(await store.get('contacts'))||[]});}
    if(path.startsWith('/api/contacts/') && method==='DELETE'){requireAdmin();const id=decodeURIComponent(path.slice('/api/contacts/'.length));const items=(await store.get('contacts'))||[];await store.put('contacts',items.filter(item=>item.id!==id));return reply(200,{ok:true});}
    return reply(404,{error:'Not found.'});
  }catch(error){return reply(error.status||500,{error:error.status?error.message:'Could not complete the request. Please try again.'});}
}

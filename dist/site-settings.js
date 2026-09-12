import defaults from './published-settings.js';
let current=defaults;
export function getSettings(){return current;}
export async function loadSettings(){
  try{const res=await fetch('/api/settings',{cache:'no-store'});if(!res.ok)throw Error();const value=await res.json();if(!Number.isInteger(value.revision)||!Array.isArray(value.websites))throw Error();current=value;}catch{}
  window.dispatchEvent(new CustomEvent('portfolio-settings',{detail:current}));return current;
}
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}

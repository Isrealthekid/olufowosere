// Optional local visual check: requires a headless browser on CDP port 9237.
import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const targets = await (await fetch('http://127.0.0.1:9237/json')).json();
const target = targets.find(tab => tab.type === 'page' && tab.url.includes('localhost:3000'));
if (!target) throw new Error('Open the local admin page in the QA browser first.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = event => { const response = JSON.parse(event.data); if (response.id && pending.has(response.id)) { const { resolve, reject } = pending.get(response.id); pending.delete(response.id); response.error ? reject(new Error(response.error.message)) : resolve(response.result); } };
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function until(expression) { for (let i = 0; i < 50; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Browser check timed out: ' + expression); }
async function screenshot(name) { const result = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(name, Buffer.from(result.data, 'base64')); }
try {
  socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.method==='Log.entryAdded')console.log(value.params.entry.text);if(value.method==='Network.loadingFailed')console.log('Network failure:',value.params.errorText,value.params.blockedReason||'');});
  await cdp('Log.enable');await cdp('Network.enable');
  await cdp('Page.navigate',{url:'http://localhost:3000/'});
  await until('!!document.querySelector(".profile-map")');
  await evaluate('document.querySelector(".contact-toggle").click()');
  await new Promise(resolve=>setTimeout(resolve,8000));
  console.log(JSON.stringify(await cdp('Page.getFrameTree')));
  await screenshot('preview-map.png');
} finally {socket.close();}


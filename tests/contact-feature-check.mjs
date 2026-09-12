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
  await cdp('Page.navigate',{url:'http://localhost:3000/'});
  await until('!!document.querySelector("#contact-tail")');
  const opened=await evaluate('document.querySelector("#contact-tail time").dateTime');
  assert.ok(Math.abs(Date.now()-Date.parse(opened))<10000);
  assert.equal(await evaluate('document.querySelector(".timeline").lastElementChild.id'),'contact-tail');
  await evaluate('document.querySelector(".timeline").scrollTop=document.querySelector(".timeline").scrollHeight');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('preview-contact-prompt.png');
  await evaluate('document.querySelector("#contact-input").value="qa-contact@example.com"; document.querySelector("#contact-form").requestSubmit()');
  await until('document.querySelector("#contact-status").textContent.startsWith("Delivered.")');
  assert.equal(await evaluate('document.querySelector("#contact-tail time").dateTime'),opened);
  assert.equal(await evaluate('document.querySelector(".sent-bubble").textContent'),'qa-contact@example.com');
  await screenshot('preview-contact-sent.png');
  await cdp('Page.navigate',{url:'http://localhost:3000/admins'});
  await until('!!document.querySelector("#login-form")');
  const password=(await readFile(new URL('../.env',import.meta.url),'utf8')).match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
  await evaluate(`document.querySelector('#password').value=${JSON.stringify(password)};document.querySelector('#login-form').requestSubmit()`);
  await until('!document.querySelector("#editor").hidden && document.querySelectorAll(".inbox-item").length>0');
  assert.equal(await evaluate('document.querySelector("#setting-githubUrl").value'),'https://github.com/Isrealthekid');
  assert.equal(await evaluate('document.querySelector("#contact-inbox").textContent.includes("qa-contact@example.com")'),true);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1348,height:900,deviceScaleFactor:1,mobile:false});
  await screenshot('preview-profile-settings-admin.png');
  await evaluate(`(async()=>{const {items}=await(await fetch('/api/contacts')).json();for(const item of items.filter(x=>x.contact==='qa-contact@example.com'))await fetch('/api/contacts/'+item.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'});})()`);
  await evaluate(`fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})`);
  console.log('Passed: visit timestamp, final prompt, sending, delivery receipt, admin settings and private inbox. QA reply deleted.');
} finally {socket.close();}


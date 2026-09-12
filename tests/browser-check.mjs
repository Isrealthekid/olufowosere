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
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1348, height: 850, deviceScaleFactor: 1, mobile: false });
  await until('!!document.querySelector("#login-form")');
  await screenshot('preview-admin-login.png');
  const env = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const password = env.match(/^ADMIN_PASSWORD=(.*)$/m)[1].trim();
  await evaluate(`document.querySelector('#password').value = ${JSON.stringify(password)}; document.querySelector('#login-form').requestSubmit();`);
  await until('document.querySelectorAll(".update-card").length === 8');
  assert.equal(await evaluate('document.querySelector("#login-section").hidden'), true);
  await evaluate(`const emoji = document.querySelector('[id$="-emoji-0"]'); emoji.value='✨'; emoji.dispatchEvent(new Event('input',{bubbles:true})); const animation=document.querySelector('[id$="-animation-0"]'); animation.value='bounce'; animation.dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await evaluate('!!document.querySelector(".message-preview .animation-bounce")'), true);
  assert.equal(await evaluate('document.querySelector(".message-preview .reaction").textContent'), '✨');
  await screenshot('preview-admin-editor.png');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('preview-admin-mobile.png');
  // Sign out without saving the visual-check draft.
  await evaluate(`fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})`);
  await cdp('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  console.log('Browser checks passed: login, eight updates, reaction preview, animation preview, mobile width. No content changes saved.');
} finally { await cdp('Browser.close').catch(() => {}); socket.close(); }

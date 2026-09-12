import { renderMessage, formatDate } from './chat-render.js';
import { initializeAdminSettings, loadExtendedAdmin, clearExtendedAdmin, hasSettingsChanges } from './admin-settings.js';
initializeAdminSettings();
const $ = selector => document.querySelector(selector);
let data = null;
let dirty = false;
let busy = false;
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const node = (tag, text, className) => { const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; };
function button(text, action, className) { const element = node('button', text, className); element.type = 'button'; element.addEventListener('click', action); return element; }
function changed() { dirty = true; status('Unsaved changes'); }
async function api(path, method = 'GET', payload) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && method !== 'GET') $('#login-section').hidden = false;
    throw new Error(result.error || 'Something went wrong. Please try again.');
  }
  return result;
}
function field(label, input, id) { const container = node('div'); const title = node('label', label); title.htmlFor = id; input.id = id; container.append(title, input); return container; }
function render() {
  const target = $('#updates'); target.replaceChildren();
  if (!data.groups.length) target.append(node('p', 'No updates yet. Add your first one above.', 'empty-note'));
  data.groups.forEach((group, groupIndex) => {
    const card = node('article', null, 'update-card');
    const heading = node('div', null, 'update-heading');
    heading.append(node('h2', formatDate(group.date)), button('Remove update', () => {
      if (!confirm('Remove this update and all its messages? You can still leave without saving.')) return;
      data.groups.splice(groupIndex, 1); changed(); render();
    }, 'danger'));
    card.append(heading);
    const dates = node('div', null, 'date-fields');
    const precision = node('select');
    for (const [value, label] of [['day', 'Exact date'], ['month', 'Month only']]) { const option = node('option', label); option.value = value; precision.append(option); }
    precision.value = group.date.length === 7 ? 'month' : 'day';
    const date = node('input'); date.type = precision.value === 'month' ? 'month' : 'date'; date.value = group.date; date.required = true;
    date.addEventListener('change', () => { if (date.value) { group.date = date.value; heading.querySelector('h2').textContent = formatDate(group.date); changed(); } });
    precision.addEventListener('change', () => { group.date = precision.value === 'month' ? group.date.slice(0, 7) : group.date.length === 7 ? group.date + '-01' : group.date; changed(); render(); });
    const time = node('input'); time.type = 'time'; time.value = group.time; time.required = true;
    time.addEventListener('input', () => { group.time = time.value; changed(); });
    dates.append(field('Date precision', precision, `${group.id}-precision`), field('Date', date, `${group.id}-date`), field('Time', time, `${group.id}-time`)); card.append(dates);
    group.messages.forEach((message, index) => {
      const row = node('section', null, 'message-editor');
      const grid = node('div', null, 'message-editor-grid');
      const controls = node('div');
      const text = node('textarea'); text.value = message.text; text.maxLength = 3000; text.required = true;
      controls.append(field(`Message ${index + 1}`, text, `${group.id}-text-${index}`));
      const options = node('div', null, 'message-controls');
      const emoji = node('input'); emoji.value = message.reaction; emoji.maxLength = 32; emoji.placeholder = 'None, or paste an emoji';
      const animation = node('select');
      for (const [value, label] of [['none', 'None'], ['fade', 'Fade in'], ['bounce', 'Bounce'], ['pulse', 'Pulse'], ['wave', 'Wiggle']]) { const option = node('option', label); option.value = value; animation.append(option); }
      animation.value = message.animation;
      options.append(field('Reaction emoji', emoji, `${group.id}-emoji-${index}`), field('Animation', animation, `${group.id}-animation-${index}`)); controls.append(options);
      const preview = node('div', null, 'message-preview');
      function refreshPreview() { preview.replaceChildren(node('span', 'Preview', 'preview-label'), renderMessage(message, index === group.messages.length - 1)); }
      text.addEventListener('input', () => { message.text = text.value; changed(); refreshPreview(); });
      emoji.addEventListener('input', () => { message.reaction = emoji.value; changed(); refreshPreview(); });
      animation.addEventListener('change', () => { message.animation = animation.value; changed(); refreshPreview(); });
      refreshPreview(); grid.append(controls, preview); row.append(grid);
      const actions = node('div', null, 'message-actions');
      if (index > 0) actions.append(button('Move up', () => { [group.messages[index - 1], group.messages[index]] = [group.messages[index], group.messages[index - 1]]; changed(); render(); }));
      if (index < group.messages.length - 1) actions.append(button('Move down', () => { [group.messages[index + 1], group.messages[index]] = [group.messages[index], group.messages[index + 1]]; changed(); render(); }));
      if (group.messages.length > 1) actions.append(button('Remove message', () => { if (message.text.trim() && !confirm('Remove this message?')) return; group.messages.splice(index, 1); changed(); render(); }, 'danger'));
      row.append(actions); card.append(row);
    });
    card.append(button('+ Add message', () => { if (group.messages.length >= 30) return status('An update can have up to 30 messages.', true); group.messages.push({ text: '', reaction: '', animation: 'none' }); changed(); render(); }));
    target.append(card);
  });
}
async function showEditor() {
  if (!data) data = await api('/api/chats');
  $('#login-section').hidden = true; $('#editor').hidden = false; $('#logout').hidden = false;
  $('#password').value = ''; render(); status(dirty ? 'Signed in. Your unsaved changes are ready to save.' : 'Ready to edit.');
  await loadExtendedAdmin();
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.currentTarget.querySelector('button'); submit.disabled = true;
  try { await api('/api/login', 'POST', { password: $('#password').value }); await showEditor(); } catch (error) { status(error.message, true); } finally { submit.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  if ((dirty || hasSettingsChanges()) && !confirm('Sign out and discard unsaved changes?')) return;
  try { await api('/api/logout', 'POST', {}); dirty = false; data = null; clearExtendedAdmin(); $('#editor').hidden = true; $('#logout').hidden = true; $('#login-section').hidden = false; $('#updates').replaceChildren(); status('Signed out.'); } catch (error) { status(error.message, true); }
});
$('#add-update').addEventListener('click', () => {
  if (data.groups.length >= 100) return status('You can have up to 100 updates.', true);
  const time = `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
  data.groups.push({ id: crypto.randomUUID(), date: new Date().toLocaleDateString('en-CA'), time, messages: [{ text: '', reaction: '', animation: 'none' }] });
  changed(); render(); $('#updates').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#save').addEventListener('click', async () => {
  if (busy) return;
  const invalid = [...$('#updates').querySelectorAll('input,textarea')].find(input => !input.checkValidity());
  if (invalid) { invalid.reportValidity(); return; }
  if (data.groups.some(group => group.messages.some(message => !message.text.trim()))) return status('Write something in each message before saving.', true);
  busy = true;
  const controls = [...$('#editor').querySelectorAll('button,input,select,textarea')]; controls.forEach(control => control.disabled = true); $('#logout').disabled = true;
  try { data = await api('/api/chats', 'PUT', data); dirty = false; render(); status('Saved. Your portfolio is up to date.'); }
  catch (error) { status(error.message, true); }
  finally { busy = false; controls.forEach(control => control.disabled = false); $('#save').disabled = false; $('#add-update').disabled = false; $('#logout').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try { if ((await api('/api/session')).authenticated) await showEditor(); } catch { status('Could not connect. Check that the portfolio server is running.', true); }

import { renderTimeline } from './chat-render.js';
import { initializeProfile } from './profile.js';
initializeProfile();
const portfolio = document.querySelector('.portfolio');
const toggle = document.querySelector('.contact-toggle');
const panel = document.querySelector('.contact-panel');
const closeButton = document.querySelector('.close-panel');

function setPanel(open) {
  panel.hidden = !open;
  portfolio.classList.toggle('panel-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} Isreal's contact information`);
  if (open) closeButton.focus({ preventScroll: true });
  else toggle.focus({ preventScroll: true });
}
toggle.addEventListener('click', () => setPanel(panel.hidden));
closeButton.addEventListener('click', () => setPanel(false));
let revision;
let showingSnapshot = false;
async function loadChats() {
  const timeline = document.querySelector('.timeline');
  try {
    const response = await fetch('/api/chats', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load messages');
    const data = await response.json();
    if (!Number.isInteger(data.revision) || !Array.isArray(data.groups)) throw new Error('Invalid messages response');
    if (data.revision === revision && !showingSnapshot) return;
    const scrollTop = timeline.scrollTop;
    renderTimeline(timeline, data.groups);
    timeline.scrollTop = scrollTop;
    revision = data.revision;
    showingSnapshot = false;
  } catch {
    if (revision !== undefined) return;
    try {
      const { default: published } = await import('./published-chats.js');
      renderTimeline(timeline, published.groups);
      revision = published.revision;
      showingSnapshot = true;
      return;
    } catch {
      // Show the retry control only if both the API and published copy fail.
    }
    const message = document.createElement('p'); message.className = 'timeline-status';
    message.textContent = 'Could not load messages. ';
    const retry = document.createElement('button'); retry.textContent = 'Try again'; retry.addEventListener('click', loadChats);
    message.append(retry); timeline.replaceChildren(message);
  }
}
loadChats();
window.addEventListener('focus', loadChats);
setInterval(() => { if (!document.hidden) loadChats(); }, 15000);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !panel.hidden) setPanel(false);
});


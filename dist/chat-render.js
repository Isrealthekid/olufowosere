export function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: value.length === 10 ? 'numeric' : undefined, month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.length === 7 ? value + '-01' : value}T12:00:00Z`));
}
export function richText(element, text) {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    element.append(document.createTextNode(text.slice(cursor, match.index)));
    const link = document.createElement('a');
    link.textContent = match[1]; link.href = match[2]; link.target = '_blank'; link.rel = 'noopener noreferrer';
    element.append(link); cursor = match.index + match[0].length;
  }
  element.append(document.createTextNode(text.slice(cursor)));
}
export function renderMessage(message, tail = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrap' + (message.reaction ? ' reacted-message' : '');
  const bubble = document.createElement('p');
  bubble.className = 'bubble' + (tail ? ' tail' : '');
  if (['fade', 'bounce', 'pulse', 'wave'].includes(message.animation)) bubble.classList.add(`animation-${message.animation}`);
  richText(bubble, message.text);
  wrapper.append(bubble);
  if (message.reaction) {
    const reaction = document.createElement('button');
    reaction.className = 'reaction'; reaction.type = 'button'; reaction.textContent = message.reaction;
    reaction.setAttribute('aria-label', `Remove ${message.reaction} reaction from this view`);
    reaction.addEventListener('click', () => reaction.remove());
    wrapper.append(reaction);
  }
  return wrapper;
}
let animationObserver;
export function renderTimeline(target, groups) {
  const fragment = document.createDocumentFragment();
  for (const group of [...groups].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))) {
    const article = document.createElement('article'); article.className = 'message-group';
    const stamp = document.createElement('p'); stamp.className = 'timestamp';
    const time = document.createElement('time'); time.dateTime = group.date.length === 10 ? `${group.date}T${group.time}` : group.date;
    const strong = document.createElement('strong'); strong.textContent = formatDate(group.date);
    time.append(strong, document.createTextNode(` at ${group.time}`)); stamp.append(time); article.append(stamp);
    const messages = document.createElement('div'); messages.className = 'messages';
    group.messages.forEach((message, index) => messages.append(renderMessage(message, index === group.messages.length - 1)));
    article.append(messages); fragment.append(article);
  }
  target.replaceChildren(fragment);
  animationObserver?.disconnect();
  animationObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animation-visible');
        animationObserver.unobserve(entry.target);
      }
    }
  }, { root: target, threshold: 0.25 });
  target.querySelectorAll('.bubble[class*="animation-"]').forEach(bubble => animationObserver.observe(bubble));
}

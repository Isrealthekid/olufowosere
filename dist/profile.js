const icons = {
  back: '<path d="m15 4-8 8 8 8"/>',
  phone: '<path d="M6 3 3 5c-1 7 9 17 16 16l2-3-5-4-3 3-6-6 3-3-4-5Z"/>',
  video: '<rect x="2" y="5" width="13" height="14" rx="3"/><path d="m15 10 7-4v12l-7-4Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/>',
  document: '<path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v6h5M8 12h8M8 16h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
export function initializeProfile() {
  const panel = document.querySelector('#contact-panel');
  panel.innerHTML = `
    <div class="profile-scroll">
      <header class="profile-hero">
        <button class="close-panel profile-back glass-button" aria-label="Back to messages">${icon('back')}</button>
        <a class="profile-edit glass-button" href="/not-allowed.html" aria-label="Edit profile">Edit</a>
        <img class="profile-avatar" src="/assets/profile.jpg" alt="Isreal’s profile picture" width="100" height="100">
        <h1>Isreal Oluwole</h1>
        <div class="profile-actions">
          <button disabled aria-label="Mobile number not added" title="Mobile number not added">${icon('phone')}</button>
          <button disabled aria-label="Video calling unavailable" title="Video calling unavailable">${icon('video')}</button>
          <a class="profile-email-action" href="mailto:oluwoleisreal12@gmail.com" aria-label="Email Isreal" title="oluwoleisreal12@gmail.com">${icon('mail')}</a>
        </div>
      </header>
      <nav class="profile-tabs" role="tablist" aria-label="Profile sections">
        ${['Info','Backgrounds','Photos','Links','Documents'].map((name,index)=>`<button role="tab" id="tab-${name.toLowerCase()}" aria-controls="profile-${name.toLowerCase()}" aria-selected="${index===0}" tabindex="${index===0?0:-1}">${name}</button>`).join('')}
      </nav>
      <section id="profile-info" class="profile-section info-section" role="tabpanel" aria-labelledby="tab-info">
        <iframe class="profile-map" src="https://www.google.com/maps/embed?origin=mfe&amp;pb=!1m3!2m1!1sAbuja,Nigeria!6i12" width="100%" height="400" loading="eager" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="Map of Abuja, Nigeria"></iframe>
        <a class="map-external-link" href="https://www.google.com/maps?q=Abuja,Nigeria" target="_blank" rel="noopener noreferrer">Open Abuja in Google Maps ↗</a>
        <div class="profile-info-row"><div><span class="info-label">mobile</span><span class="unset-detail">Not added</span></div>${icon('phone')}</div>
        <a class="profile-info-row profile-email-row" href="mailto:oluwoleisreal12@gmail.com"><div><span class="info-label">email</span><span>oluwoleisreal12@gmail.com</span></div>${icon('mail')}</a>
        <div class="profile-info-row profile-notes"><div><span class="info-label">notes</span><p>making things work, and making them feel right.</p><p>software engineering, frontend development, and graphic design. a few life updates, one message at a time.</p></div></div>
      </section>
      <section id="profile-backgrounds" class="profile-section backgrounds-section" role="tabpanel" aria-labelledby="tab-backgrounds" hidden>
        <div class="background-options">
          ${[['none','None'],['photo','Photo'],['color','Color'],['sky','Sky'],['water','Water'],['aurora','Aurora']].map(([key,name])=>`<button class="background-option" data-background="${key}" aria-pressed="false"><span class="background-orb background-${key}">${key==='photo'?icon('photo'):''}<span class="selected-check">${icon('check')}</span></span><span>${name}</span></button>`).join('')}
        </div>
        <input type="file" id="background-upload" accept="image/jpeg,image/png,image/webp" hidden>
        <p class="background-status" role="status"></p>
        <h2>Suggestions</h2>
        <div class="background-suggestions">${[['green','Fresh green'],['sunset','Evening light'],['water','Still water'],['aurora','Aurora']].map(([key,name])=>`<button class="background-suggestion background-${key}" data-background="${key}" aria-label="Use ${name} background" aria-pressed="false"></button>`).join('')}</div>
      </section>
      <section id="profile-photos" class="profile-section photos-section" role="tabpanel" aria-labelledby="tab-photos" hidden>
        <div class="photo-grid"><button class="profile-photo" aria-label="Open profile photo"><img src="/assets/profile.jpg" alt="Isreal’s Zuko profile picture"></button></div>
      </section>
      <section id="profile-links" class="profile-section links-section" role="tabpanel" aria-labelledby="tab-links" hidden>
        <div class="profile-link-grid">${[['Engineering Resource Academy','era.com.ng','ERA'],['Teacch','teacch.co','teacch'],['Greatiby','greatiby.com','Greatiby']].map(([name,domain,mark],i)=>`<a class="profile-link-card link-style-${i}" href="https://${domain}" target="_blank" rel="noopener noreferrer"><span class="link-art" aria-hidden="true">${mark}</span><span class="link-caption"><strong>${name}</strong><span>${domain}</span></span></a>`).join('')}</div>
      </section>
      <section id="profile-documents" class="profile-section" role="tabpanel" aria-labelledby="tab-documents" hidden><div class="profile-empty">${icon('document')}<h2>No documents yet</h2><p>Documents will appear here when added.</p></div></section>
    </div>
    <dialog class="photo-viewer"><button class="photo-close glass-button" aria-label="Close photo">×</button><img src="/assets/profile.jpg" alt="Isreal’s full profile picture"></dialog>`;
  const tabs = [...panel.querySelectorAll('[role="tab"]')];
  const navigation = panel.querySelector('.profile-tabs');
  const glass = document.createElement('span');
  glass.className = 'nav-glass-drop';
  glass.setAttribute('aria-hidden', 'true');
  navigation.prepend(glass);
  let glassAnimation;
  let glassReady = false;
  function moveGlass(tab, animate = false) {
    if (!navigation.clientWidth) return;
    const navRect = navigation.getBoundingClientRect();
    const oldRect = glass.getBoundingClientRect();
    const target = tab.getBoundingClientRect();
    const left = target.left - navRect.left + navigation.scrollLeft;
    const top = target.top - navRect.top + navigation.scrollTop;
    const oldLeft = oldRect.left - navRect.left + navigation.scrollLeft;
    const oldTop = oldRect.top - navRect.top + navigation.scrollTop;
    glassAnimation?.cancel();
    Object.assign(glass.style, { left: `${left}px`, top: `${top}px`, width: `${target.width}px`, height: `${target.height}px` });
    if (animate && glassReady && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const delta = oldLeft - left;
      const direction = Math.sign(-delta);
      const stretch = Math.min(1.22, 1.08 + Math.abs(delta) / 1600);
      glassAnimation = glass.animate([
        { transform: `translate(${delta}px, ${oldTop - top}px) scale(1, 1)`, width: `${oldRect.width}px`, offset: 0 },
        { transform: `translateX(${delta * .38}px) scale(${stretch}, .87) skewX(${-direction * 5}deg)`, width: `${target.width}px`, offset: .34 },
        { transform: `translateX(${direction * 7}px) scale(.95, 1.06) skewX(${direction * 3}deg)`, offset: .64 },
        { transform: `translateX(${-direction * 3}px) scale(1.025, .98)`, offset: .82 },
        { transform: 'translateX(0) scale(1, 1)', width: `${target.width}px`, offset: 1 }
      ], { duration: 520, easing: 'cubic-bezier(.22,.7,.25,1)' });
    }
    glassReady = true;
  }
  new ResizeObserver(() => moveGlass(tabs.find(tab => tab.getAttribute('aria-selected') === 'true'))).observe(navigation);
  document.fonts.ready.then(() => moveGlass(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')));
  function selectTab(tab) {
    const previousIndex = tabs.findIndex(item => item.getAttribute('aria-selected') === 'true');
    const nextIndex = tabs.indexOf(tab);
    if (previousIndex === nextIndex) return;
    tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; document.getElementById(item.getAttribute('aria-controls')).hidden = !selected; });
    moveGlass(tab, true);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tab.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
  }
  tabs.forEach((tab,index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if(event.key==='ArrowRight') next=tabs[(index+1)%tabs.length];
      if(event.key==='ArrowLeft') next=tabs[(index-1+tabs.length)%tabs.length];
      if(event.key==='Home') next=tabs[0];
      if(event.key==='End') next=tabs.at(-1);
      if(next){event.preventDefault();selectTab(next);next.focus();}
    });
  });
  navigation.addEventListener('wheel',event=>{if(navigation.scrollWidth>navigation.clientWidth && Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();navigation.scrollLeft+=event.deltaY;}},{passive:false});
  const viewer=panel.querySelector('.photo-viewer');
  panel.querySelector('.profile-photo').addEventListener('click',()=>viewer.showModal());
  panel.querySelector('.photo-close').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
  viewer.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  const choices=['none','photo','color','sky','water','aurora','green','sunset'];
  const portfolio=document.querySelector('.portfolio');
  let photo;
  function setBackground(value, persist=true) {
    if(!choices.includes(value)) value='none';
    portfolio.dataset.background=value;
    document.querySelector('#chat-photo-background')?.remove();
    if(value==='photo' && photo){const image=document.createElement('img');image.id='chat-photo-background';image.className='chat-photo-background';image.src=photo;image.alt='';portfolio.prepend(image);}
    panel.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===value)));
    if(persist){try{localStorage.setItem('portfolio-background',value);}catch{}}
  }
  try{photo=localStorage.getItem('portfolio-background-photo');if(photo && !/^data:image\/(jpeg|png|webp);base64,/.test(photo))photo=null;setBackground(localStorage.getItem('portfolio-background')||'none',false);}catch{setBackground('none',false);}
  panel.querySelectorAll('[data-background]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.background==='photo')panel.querySelector('#background-upload').click();else setBackground(button.dataset.background);}));
  panel.querySelector('#background-upload').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    const status=panel.querySelector('.background-status');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){status.textContent='Choose a JPG, PNG, or WebP under 3 MB.';return;}
    const reader=new FileReader();reader.onload=()=>{photo=reader.result;setBackground('photo');try{localStorage.setItem('portfolio-background-photo',photo);status.textContent='Background saved for this browser.';}catch{status.textContent='Background applied for this visit.';}};reader.onerror=()=>status.textContent='Could not read that image. Try another one.';reader.readAsDataURL(file);
  });
}

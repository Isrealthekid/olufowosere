let settings=null,dirty=false;
const $=selector=>document.querySelector(selector);
export const hasSettingsChanges=()=>dirty;
const status=(message,error=false)=>{const target=$('#settings-status');target.textContent=message;target.classList.toggle('error',error);};
async function api(path,method='GET',body){const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json();}catch{throw Error('Could not connect to the server.');}if(!r.ok){if(r.status===401)$('#login-section').hidden=false;throw Error(data.error||'Request failed.');}return data;}
function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
function drawLinks(){const target=$('#website-settings');target.replaceChildren();settings.websites.forEach((link,index)=>{
  const row=node('div');row.className='website-setting';const name=node('input');name.value=link.title;name.placeholder='Website name';name.required=true;name.maxLength=150;name.setAttribute('aria-label',`Website ${index+1} name`);
  const url=node('input');url.type='url';url.value=link.url;url.placeholder='https://example.com';url.required=true;url.setAttribute('aria-label',`Website ${index+1} URL`);
  name.addEventListener('input',()=>{link.title=name.value;dirty=true;});url.addEventListener('input',()=>{link.url=url.value;dirty=true;});
  const remove=node('button','Remove');remove.type='button';remove.className='danger';remove.addEventListener('click',()=>{settings.websites.splice(index,1);dirty=true;drawLinks();});row.append(name,url,remove);target.append(row);
});}
function populate(){for(const key of ['driveFolder','githubUrl','cvUrl','cvTitle','contactPrompt','contactPlaceholder'])$(`#setting-${key}`).value=settings[key];$('#setting-contactEnabled').checked=settings.contactEnabled;drawLinks();}
export async function loadExtendedAdmin(){
  try{if(!settings){settings=await api('/api/settings');populate();}await loadInbox();}catch(error){status(error.message,true);}
}
export function clearExtendedAdmin(){settings=null;dirty=false;$('#contact-inbox').replaceChildren();$('#profile-settings-form').reset();$('#website-settings').replaceChildren();status('');}
async function loadInbox(){const target=$('#contact-inbox');target.textContent='Loading replies…';try{const {items}=await api('/api/contacts');target.replaceChildren();if(!items.length){target.textContent='No replies yet.';return;}for(const item of items){const card=node('article');card.className='inbox-item';const time=node('time',new Date(item.receivedAt).toLocaleString());time.dateTime=item.receivedAt;const content=node('p',item.contact);const remove=node('button','Delete');remove.type='button';remove.className='danger';remove.addEventListener('click',async()=>{if(!confirm('Delete this contact reply permanently?'))return;remove.disabled=true;try{await api('/api/contacts/'+encodeURIComponent(item.id),'DELETE',{});await loadInbox();}catch(error){target.prepend(node('p',error.message));remove.disabled=false;}});card.append(time,content,remove);target.append(card);}}catch(error){target.textContent=error.message;}}
export function initializeAdminSettings(){
  $('#profile-settings-form').addEventListener('input',()=>{dirty=true;status('Unsaved profile changes');});
  $('#add-website').addEventListener('click',()=>{if(!settings)return;if(settings.websites.length>=30)return status('You can add up to 30 websites.',true);settings.websites.push({title:'',url:''});dirty=true;drawLinks();});
  $('#refresh-inbox').addEventListener('click',loadInbox);
  $('#profile-settings-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!settings)return;
    const draft=structuredClone(settings);for(const key of ['driveFolder','githubUrl','cvUrl','cvTitle','contactPrompt','contactPlaceholder'])draft[key]=$(`#setting-${key}`).value.trim();draft.contactEnabled=$('#setting-contactEnabled').checked;
    const controls=[...event.currentTarget.querySelectorAll('button,input,textarea')];controls.forEach(c=>c.disabled=true);status('Saving…');
    try{settings=await api('/api/settings','PUT',draft);dirty=false;populate();status('Saved. Your profile and final message are updated.');}catch(error){status(error.message,true);}finally{controls.forEach(c=>c.disabled=false);}
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}

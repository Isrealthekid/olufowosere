import { renderMessage } from './chat-render.js';
import { getSettings } from './site-settings.js';
const openedAt=new Date();
const sent=[];
let pendingId;
let pendingText;
function stamp(date){const p=document.createElement('p');p.className='timestamp';const time=document.createElement('time');time.dateTime=date.toISOString();const strong=document.createElement('strong');strong.textContent=date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});time.append(strong,document.createTextNode(` at ${date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}`));p.append(time);return p;}
export function renderContactTail(){
  const timeline=document.querySelector('.timeline');timeline.querySelector('#contact-tail')?.remove();
  const settings=getSettings();const group=document.createElement('article');group.id='contact-tail';group.className='message-group';
  group.append(stamp(openedAt));const messages=document.createElement('div');messages.className='messages';messages.append(renderMessage({text:settings.contactPrompt,reaction:'',animation:'none'},true));group.append(messages);
  for(const item of sent){const wrap=document.createElement('div');wrap.className='sent-reply';wrap.append(stamp(new Date(item.receivedAt)));const bubble=document.createElement('p');bubble.className='bubble sent-bubble';bubble.textContent=item.contact;wrap.append(bubble);const receipt=document.createElement('span');receipt.className='delivery-receipt';receipt.textContent='Delivered';wrap.append(receipt);group.append(wrap);}
  timeline.append(group);
  const input=document.querySelector('#contact-input');input.placeholder=settings.contactPlaceholder;input.disabled=!settings.contactEnabled;document.querySelector('#contact-send').disabled=!settings.contactEnabled;
  if(!settings.contactEnabled)document.querySelector('#contact-status').textContent='Replies are closed. You can use the email in my profile.';
}
export function initializeContactChat(){
  const form=document.querySelector('#contact-form');const input=document.querySelector('#contact-input');const button=document.querySelector('#contact-send');const status=document.querySelector('#contact-status');
  form.addEventListener('submit',async event=>{
    event.preventDefault();const contact=input.value.trim();if(contact.length<3){status.textContent='Add an email, phone number, or social handle.';input.focus();return;}
    if(contact!==pendingText){pendingId=crypto.randomUUID();pendingText=contact;}
    button.disabled=true;input.readOnly=true;status.textContent='Sending…';
    try{
      const response=await fetch('/api/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pendingId,contact,openedAt:openedAt.toISOString(),website:form.elements.website.value})});
      let result;try{result=await response.json();}catch{throw Error('Could not send. Please try again or use my profile email.');}
      if(!response.ok)throw Error(result.error||'Could not send. Please try again.');
      if(!result.ok||!result.receivedAt)throw Error('Could not confirm delivery. Please try again.');
      if(!sent.some(item=>item.id===result.id))sent.push({...result,contact});
      pendingId=null;pendingText=null;input.value='';status.textContent='Delivered. Your contact details are in my inbox.';renderContactTail();
      const timeline=document.querySelector('.timeline');timeline.scrollTo({top:timeline.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }catch(error){status.textContent=error.message;}
    finally{input.readOnly=false;button.disabled=!getSettings().contactEnabled;}
  });
}

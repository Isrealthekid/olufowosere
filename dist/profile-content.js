import { safeLink } from './site-settings.js';
import { loadPhotoGallery } from './photo-gallery.js';
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
function empty(section,title,description){section.replaceChildren();const box=el('div',null,'profile-empty');box.append(el('h2',title),el('p',description));section.append(box);}
export function updateProfileContent(settings){
  const photos=document.querySelector('#profile-photos');
  const folder=safeLink(settings.driveFolder);const parsed=folder?new URL(folder):null;const id=parsed?.hostname==='drive.google.com'?parsed.pathname.match(/\/folders\/([\w-]+)/)?.[1]:null;
  loadPhotoGallery(photos,id?folder:'');
  const links=document.querySelector('#profile-links');links.replaceChildren();const grid=el('div',null,'profile-link-grid');
  const entries=[...(settings.githubUrl?[{title:'GitHub',url:settings.githubUrl}]:[]),...settings.websites];
  entries.forEach((item,index)=>{const url=safeLink(item.url);if(!url)return;const card=el('a',null,`profile-link-card link-style-${index%3}`);card.href=url;card.target='_blank';card.rel='noopener noreferrer';const art=el('span',item.title,'link-art');const caption=el('span',null,'link-caption');caption.append(el('strong',item.title),el('span',new URL(url).hostname));card.append(art,caption);grid.append(card);});
  if(grid.childElementCount)links.append(grid);else empty(links,'No links yet','Project links will appear here soon.');
  const documents=document.querySelector('#profile-documents');const cv=safeLink(settings.cvUrl);
  if(cv){documents.replaceChildren();const card=el('a',null,'cv-card');card.href=cv;card.target='_blank';card.rel='noopener noreferrer';card.append(el('span','CV','cv-mark'),el('strong',settings.cvTitle),el('span','View CV ↗'));documents.append(card);}else empty(documents,'CV coming soon','Check back for my CV.');
}

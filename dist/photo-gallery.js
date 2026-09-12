let folderShown,controller;
export function loadPhotoGallery(section,folder){
  if(folderShown===folder)return;
  folderShown=folder;controller?.abort();controller=new AbortController();
  const signal=controller.signal;
  const note=message=>{section.replaceChildren();const p=document.createElement('p');p.className='gallery-status';p.textContent=message;section.append(p);};
  if(!folder){note('Design work will appear here soon.');return;}
  note('Loading designs…');
  (async()=>{
    try{
      const response=await fetch('/api/photos',{signal});const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not load designs.');
      if(!Array.isArray(data.photos))throw Error('Could not load designs.');
      if(signal.aborted)return;
      if(!data.photos.length){note('No images in this folder yet.');return;}
      const grid=document.createElement('div');grid.className='photo-grid';
      for(const photo of data.photos){
        const button=document.createElement('button');button.className='profile-photo';button.type='button';button.setAttribute('aria-label',`View ${photo.name}`);
        const image=document.createElement('img');image.src=photo.thumbnail;image.alt=photo.name;image.loading='lazy';image.referrerPolicy='no-referrer';
        image.addEventListener('error',()=>{button.textContent=photo.name;button.classList.add('photo-unavailable');});
        button.append(image);button.addEventListener('click',()=>{
          const dialog=document.querySelector('.photo-viewer');const full=dialog.querySelector('img');full.src=photo.image;full.alt=photo.name;full.referrerPolicy='no-referrer';dialog.showModal();
        });grid.append(button);
      }
      section.replaceChildren(grid);
    }catch(error){if(signal.aborted)return;note(error.message);const retry=document.createElement('button');retry.className='gallery-retry';retry.textContent='Try again';retry.addEventListener('click',()=>{folderShown=undefined;loadPhotoGallery(section,folder);});section.append(retry);}
  })();
}

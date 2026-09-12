export async function listPhotos(settings, env, store, fetcher=fetch) {
  const folder=new URL(settings.driveFolder);
  const id=folder.pathname.match(/\/folders\/([\w-]+)/)?.[1];
  if(folder.hostname!=='drive.google.com'||!id)throw Error('Invalid folder');
  if(!env.GOOGLE_DRIVE_API_KEY)throw Object.assign(Error('The design gallery is not connected yet.'),{status:503});
  const cached=await store.get('photo-cache');
  if(cached?.folder===settings.driveFolder&&cached.expires>Date.now())return cached.photos;
  let pageToken;let pages=0;const photos=[];
  do {
    if(++pages>30)throw Object.assign(Error('The design folder is too large.'),{status:502});
    const url=new URL('https://www.googleapis.com/drive/v3/files');
    url.search=new URLSearchParams({key:env.GOOGLE_DRIVE_API_KEY,q:`'${id}' in parents and trashed = false and mimeType contains 'image/'`,fields:'nextPageToken,files(id,name,thumbnailLink)',pageSize:'100',orderBy:'name_natural',...(pageToken?{pageToken}:{})}).toString();
    const resourceKey=folder.searchParams.get('resourcekey');
    const response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:resourceKey?{'X-Goog-Drive-Resource-Keys':`${id}/${resourceKey}`}:{}});
    if(!response.ok)throw Object.assign(Error('Could not load the designs. Please try again shortly.'),{status:502});
    const data=await response.json();
    for(const file of data.files||[]){
      if(!file.thumbnailLink)continue;
      const image=new URL(file.thumbnailLink);
      if(image.protocol!=='https:'||!(image.hostname.endsWith('.googleusercontent.com')||image.hostname==='lh3.google.com'))continue;
      photos.push({id:file.id,name:file.name,thumbnail:image.href,image:image.href.replace(/=s\d+(?=$|&)/,'=s1600')});
    }
    pageToken=data.nextPageToken;
    if(photos.length>2000)throw Object.assign(Error('The design folder is too large.'),{status:502});
  }while(pageToken);
  await store.put('photo-cache',{folder:settings.driveFolder,expires:Date.now()+300000,photos});return photos;
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listPhotos} from '../backend/photos.mjs';
test('photo listing paginates, filters image hosts, caches results and keeps credentials server-side',async()=>{
  let cache;const store={get:async()=>cache,put:async(_,value)=>{cache=value;}};
  const settings={driveFolder:'https://drive.google.com/drive/folders/folder123'};
  await assert.rejects(()=>listPhotos(settings,{},store),/not connected/);
  let calls=0;
  const fetcher=async url=>{calls++;assert.equal(url.searchParams.get('key'),'test-key');return Response.json(calls===1?{nextPageToken:'next',files:[{id:'1',name:'Design',thumbnailLink:'https://lh3.googleusercontent.com/image=s220'},{id:'bad',thumbnailLink:'https://example.com/image'}]}:{files:[{id:'2',name:'Second',thumbnailLink:'https://lh3.googleusercontent.com/other=s220'}]});};
  const images=await listPhotos(settings,{GOOGLE_DRIVE_API_KEY:'test-key'},store,fetcher);
  assert.equal(images.length,2);assert.equal(calls,2);assert.match(images[0].image,/s1600$/);assert.ok(!JSON.stringify(images).includes('test-key'));
  await listPhotos(settings,{GOOGLE_DRIVE_API_KEY:'test-key'},store,fetcher);assert.equal(calls,2);
});

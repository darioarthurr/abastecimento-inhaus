const CACHE='abastecimento-v2-1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const {request}=e;
  if(request.url.includes('google.com')||request.url.includes('googleusercontent')) return;
  e.respondWith(caches.match(request).then(cached=>{
    const fetchPromise=fetch(request).then(netRes=>{
      if(netRes.ok) caches.open(CACHE).then(c=>c.put(request,netRes.clone()));
      return netRes;
    }).catch(()=>cached);
    return cached||fetchPromise;
  }));
});

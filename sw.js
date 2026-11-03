// Funciona sin conexión: la página se pide primero a la red (siempre la última versión) y si no hay, se usa la copia guardada
const CACHE='casa-v2';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const keep=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return res};
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin===location.origin){e.respondWith(fetch(req).then(r=>keep(req,r)).catch(()=>caches.match(req).then(m=>m||caches.match('./index.html'))));return}
  if(/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname))
    e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>keep(req,r))));
});

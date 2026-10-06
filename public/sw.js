const CACHE='moon-pattern-shell-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/me','/patterns','/icon.svg','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api')||url.search)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname).then(hit=>hit||caches.match('/'))));return;}
if(url.pathname.startsWith('/_next/static/')||['/icon.svg','/manifest.webmanifest'].includes(url.pathname)){event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;})));}});

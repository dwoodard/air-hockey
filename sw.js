const cacheName = 'air-hockey-v2'
const shell = ['./','./index.html','./game.css','./game.js','./icon.svg','./manifest.webmanifest']
self.addEventListener('install', e => e.waitUntil(caches.open(cacheName).then(c=>c.addAll(shell)).then(()=>self.skipWaiting())))
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('air-hockey-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim())))
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')))
    return
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))
})

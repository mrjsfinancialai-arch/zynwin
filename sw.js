// Joker's Abstract Wins service worker: network-first for HTML/JS/CSS (updates show quickly), cache-first for images.
const CACHE='jaw-v3';
const CORE=['./','index.html','app.js','api.js','live.js','pwa.js','style.css','logo.svg','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 const fresh=r.mode==='navigate'||/\.(html|js|css|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
 if(fresh){e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));}return res;}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):undefined))));}
 else e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));}return res;})));});

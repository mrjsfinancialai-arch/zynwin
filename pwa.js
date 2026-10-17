// PWA: register service worker + small "Add to home screen" hint.
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{}));
(()=>{const KEY='jaw-a2hs-dismissed',standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 if(standalone||localStorage.getItem(KEY))return;let deferred=null;
 const show=html=>{if(document.getElementById('a2hs'))return;const d=document.createElement('div');d.id='a2hs';
  d.style.cssText='position:fixed;left:10px;right:10px;bottom:72px;z-index:50;background:#fff;border:2px solid #7C3AED;border-radius:14px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.15);font-size:14px;display:flex;gap:8px;align-items:center';
  d.innerHTML=`<img src="icon-192.png" width="32" height="32" alt=""><div style="flex:1">${html}</div><button id="a2hs-x" aria-label="Dismiss" style="border:0;background:none;font-size:18px;cursor:pointer">✕</button>`;
  document.body.appendChild(d);document.getElementById('a2hs-x').onclick=()=>{localStorage.setItem(KEY,'1');d.remove();};
  const b=document.getElementById('a2hs-go');if(b)b.onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;d.remove();};};
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;show(`<b>Install Abstract Wins</b><br><button id="a2hs-go" style="margin-top:4px;background:#22C55E;color:#fff;border:0;border-radius:10px;padding:6px 12px;font-weight:700;cursor:pointer">Add to home screen</button>`);});
 addEventListener('appinstalled',()=>{const d=document.getElementById('a2hs');if(d)d.remove();});
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios)setTimeout(()=>show(`<b>Install Abstract Wins:</b> tap <b>Share</b> <span aria-hidden="true">⬆️</span> then <b>Add to Home Screen</b>.`),2500);})();

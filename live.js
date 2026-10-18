// LIVE mode: real Supabase Auth + database (RLS-protected) + CPX Research survey wall.
// The anon key below is public by design; all money rules are enforced in Postgres (see supabase/migrations).
const SB_URL='https://njuzlxafgpxzsdvvlsig.supabase.co',SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdXpseGFmZ3B4enNkdnZsc2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzcyMTksImV4cCI6MjEwNzcxMzIxOX0.okKFjkufnvDFYuic4NnCY2orqj-fk7BfjHJ7u6kTeGc';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LIVE=(()=>{
 const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
 const st={ready:false,session:null,profile:null,bal:{available:0,pending:0},ledger:[],payouts:[],wall:null,wallErr:null,admin:null,adminErr:null,busy:false};
 const redirect=location.origin+location.pathname;
 async function refresh(){const u=st.session&&st.session.user;if(!u){st.profile=null;st.ready=true;render();return}
  const[p,b,l,r]=await Promise.all([sb.from('profiles').select('*').eq('id',u.id).maybeSingle(),sb.from('balances').select('*').maybeSingle(),
   sb.from('ledger').select('id,delta_won,type,source,status,available_at,created_at,partner_txn_id').order('created_at',{ascending:false}).limit(100),
   sb.from('payout_requests').select('*').order('created_at',{ascending:false}).limit(50)]);
  st.profile=p.data||null;st.bal={available:(b.data&&b.data.available_won)||0,pending:(b.data&&b.data.pending_won)||0};
  st.ledger=l.data||[];st.payouts=r.data||[];st.ready=true;render();}
 async function wall(){if(st.wall||st.wallLoading)return;st.wallLoading=true;
  const{data,error}=await sb.functions.invoke('cpx-wall-url',{method:'POST'});st.wallLoading=false;
  if(error||!data||!data.url){st.wallErr='Surveys could not load right now. Please try again in a minute.';}else{st.wall=data.url;st.wallErr=null;}
  if(location.hash==='#offers')render();}
 async function admin(){const[a,b]=await Promise.all([sb.rpc('admin_summary'),sb.rpc('admin_payouts')]);
  if(a.error||b.error){st.adminErr=(a.error||b.error).message;st.admin=null;}else{st.admin={sum:a.data,rows:b.data};st.adminErr=null;}
  if(location.hash==='#admin')render();}
 const run=async(f,ok)=>{if(st.busy)return;st.busy=true;try{await f();if(ok)toast(ok)}catch(e){toast(e.message||String(e))}finally{st.busy=false;}};
 const chk=({error})=>{if(error)throw Error(error.message);};
 return{sb,st,refresh,wall,admin,run,
  init(){sb.auth.onAuthStateChange((ev,s)=>{const was=st.session&&st.session.user.id;st.session=s;if(!s){st.wall=null;st.admin=null;}
    if((s&&s.user.id)!==was||ev==='INITIAL_SESSION')setTimeout(refresh,0);if(location.hash.includes('access_token'))history.replaceState(null,'',redirect+'#home');});
   setInterval(()=>{if(st.session&&!['#offers','#admin'].includes(location.hash)&&!document.activeElement.matches('input,select'))refresh()},60000);},
  signIn:(email,pw)=>run(async()=>chk(await sb.auth.signInWithPassword({email,password:pw}))),
  signUp:(email,pw)=>run(async()=>{const{data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:redirect}});if(error)throw error;
   if(!data.session)toast('Check your email to confirm your account 📩');}),
  magic:(email)=>run(async()=>chk(await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect,shouldCreateUser:true}})),'Magic link sent — check your email 📩'),
  reset:(email)=>run(async()=>chk(await sb.auth.resetPasswordForEmail(email,{redirectTo:redirect+'#account'})),'Password reset email sent 📩'),
  setPw:(pw)=>run(async()=>chk(await sb.auth.updateUser({password:pw})),'Password saved'),
  signOut:()=>run(async()=>{await sb.auth.signOut();location.hash='home';}),
  createProfile:(dob)=>run(async()=>{const d=new Date(dob),a=new Date();a.setFullYear(a.getFullYear()-18);
   if(!dob||isNaN(d))throw Error('Enter your date of birth');if(d>a)throw Error('Sorry — you must be 18 or older to join.');
   chk(await sb.from('profiles').insert({id:st.session.user.id,date_of_birth:dob,age_confirmed_at:new Date().toISOString()}));await refresh();},'Welcome! 🎉'),
  payout:(amt,method)=>run(async()=>{chk(await sb.rpc('request_payout',{p_amount_won:+amt,p_method:method}));await refresh();location.hash='redeem';},'Cash-out requested ✅'),
  setPayout:(id,status,ref)=>run(async()=>{chk(await sb.rpc('admin_set_payout',{p_id:id,p_status:status,p_ref:ref||null}));await admin();},'Updated'),
  addReceipt:(usd,note)=>run(async()=>{chk(await sb.rpc('admin_add_receipt',{p_partner:'cpx',p_usd:+usd,p_note:note||null}));await admin();},'Receipt recorded')};})();

const L=LIVE.st,me=()=>L.session&&L.session.user;
const lbl=x=>x.type==='payout'?'💳 Cash-out':x.type==='payout_refund'?'↩️ Cash-out refunded':x.type==='reversal'?'❌ Survey reversed by partner':x.type==='offer'?'📝 '+(x.source==='cpx'?'CPX survey':x.source):x.type==='referral'?'👥 Referral':'🎁 Bonus';
const stat=x=>x.status==='reversed'?'<span class="neg">Reversed</span>':x.delta_won>0&&new Date(x.available_at)>new Date()?`<span class="pend">⏳ Pending · unlocks ${new Date(x.available_at).toLocaleDateString()}</span>`:'<span class="pos">✓ Available</span>';
const ledgerList=t=>t.length?t.map(x=>`<div class="card row"><div><b>${lbl(x)}</b><div class="muted">${new Date(x.created_at).toLocaleDateString()} · ${stat(x)}</div></div><span class="${x.status==='reversed'?'muted':x.delta_won>0?'pos':'neg'}">${x.delta_won>0?'+':''}${n(x.delta_won)}</span></div>`).join(''):'<p class="muted">No activity yet — complete a survey on the Offers tab to start earning.</p>';
const liveFunded=`<div class="card note">💚 <b>How rewards are funded</b><p class="muted">Our survey partner CPX Research pays Joker's Abstract Wins when you complete a survey. You get 30% of that payout as ${U} (100 ${U} = $1.00) — the amount is shown on every survey. Your total per survey is capped at 50% of what the partner pays. New earnings stay ⏳ Pending for 14 days while the partner confirms, then become Available. We only pay cash-outs from money partners have actually sent us. Earnings vary and aren't guaranteed.</p></div>`;
function gate(){if(!L.ready)return'<div class="card"><p class="muted">Loading…</p></div>';if(!me())return views.login();if(!L.profile)return views.welcome();return null;}
const LV={
 login(){return`<h1>Welcome 🃏</h1><div class="card hero"><div class="big" style="font-size:26px">Earn ${U} from paid surveys</div><p class="muted">100 ${U} = $1.00 · cash out from $5 · 18+ · US only</p></div>
<div class="card"><b>Sign in or create an account</b><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com">
<input id="pw" type="password" autocomplete="current-password" placeholder="Password (8+ characters)">
<div class="row" style="gap:8px"><button class="btn" style="flex:1" onclick="LIVE.signIn($('#em').value.trim(),$('#pw').value)">Sign in</button><button class="btn ghost" style="flex:1" onclick="LIVE.signUp($('#em').value.trim(),$('#pw').value)">Create account</button></div>
<p class="muted" style="margin:12px 0 6px">No password? Get a one-tap sign-in link by email:</p><button class="btn ghost" style="width:100%" onclick="LIVE.magic($('#em').value.trim())">📩 Email me a magic link</button>
<p class="muted" style="margin-top:10px"><a href="#" onclick="event.preventDefault();LIVE.reset($('#em').value.trim())">Forgot password?</a></p></div>
<p class="muted">By continuing you agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.</p>${liveFunded}`},
 welcome(){const max=new Date();max.setFullYear(max.getFullYear()-18);return`<h1>One last step</h1><div class="card"><b>Confirm you're 18+</b><p class="muted">Joker's Abstract Wins is for adults 18+ in the US. Your date of birth is used only for eligibility.</p>
<label class="muted">Date of birth</label><input id="dob" type="date" max="${max.toISOString().slice(0,10)}">
<label class="muted" style="display:flex;gap:8px;align-items:flex-start;margin:10px 0"><input id="ok18" type="checkbox" style="width:auto;margin-top:3px"> I confirm I am 18 or older, live in the US, and agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>. One account per person.</label>
<button class="btn" style="width:100%" onclick="if(!$('#ok18').checked)toast('Please confirm you are 18+ and agree to the Terms');else LIVE.createProfile($('#dob').value)">Start earning</button></div>
<div class="card"><span class="muted">Signed in as ${esc(me().email)}</span> · <a href="#" onclick="event.preventDefault();LIVE.signOut()">Sign out</a></div>`},
 home(){const g=gate();if(g)return g;const b=L.bal,p=Math.min(100,b.available/API.MIN*100),Lv=API.level();return`<div class="row"><h1>Hi ${avatar()}</h1><a href="#level" class="lvl">Lv ${Lv.level}</a></div>
<div class="card hero"><div class="muted">Your ${U}</div><div class="big">${n(b.available+b.pending)}<span class="unit">${U}</span></div><div class="muted">100 ${U} = $1.00</div>${bal(b)}
<div class="bar"><i style="width:${p}%"></i></div><div class="row"><span class="muted">${b.available>=API.MIN?'You can cash out now!':n(API.MIN-b.available)+' Available to the 500 $WON ($5) minimum'}</span><a href="#redeem"><button class="btn">Cash out</button></a></div></div>
<a href="#offers" style="text-decoration:none"><div class="card toppick row"><div><span class="tag top">⭐ Earn now</span><div style="margin-top:4px"><b>📝 Paid surveys by CPX Research</b></div><div class="muted">You get 30% of what the partner pays, shown on each survey</div></div><button class="btn">Open</button></div></a>
<div class="row"><h2>Recent activity</h2><a href="#history" class="muted">See all</a></div>${ledgerList(L.ledger.slice(0,3))}${liveFunded}`},
 offers(){const g=gate();if(g)return g;if(!L.wall&&!L.wallErr)LIVE.wall();
  return`<h1>Surveys</h1><p class="muted" style="margin:-6px 0 10px">Each survey shows what you'll earn in $WON (100 $WON = $1). Credits arrive automatically and stay ⏳ Pending for 14 days while CPX Research confirms. Screen-outs and partial surveys may pay little or nothing.</p>
${L.wall?`<div class="card" style="padding:0;overflow:hidden"><iframe id="cpx" src="${esc(L.wall)}" title="CPX Research surveys" style="width:100%;height:1600px;border:0;display:block" allow="clipboard-write"></iframe></div><p class="muted">Surveys provided by CPX Research. Trouble loading? <a href="${esc(L.wall)}" target="_blank" rel="noopener">Open surveys in a new tab ↗</a></p>`
  :L.wallErr?`<div class="card note">${esc(L.wallErr)} <button class="btn sm" onclick="LIVE.st.wallErr=null;render()">Retry</button></div>`:'<div class="card"><p class="muted">Loading surveys…</p></div>'}`},
 redeem(){const g=gate();if(g)return g;const b=L.bal;return`<h1>Cash out</h1><div class="card hero"><div class="muted">Available to cash out</div><div class="big">${n(b.available)}<span class="unit">${U}</span></div><div class="muted">${usd(b.available)} value · ⏳ ${n(b.pending)} pending</div></div>
<div class="card"><b>Request a cash-out</b><select id="m" onchange="PM=this.value;render()"><option value="gift_card" ${window.PM!=='paypal'?'selected':''}>Gift card (Amazon, Target, Visa…) — from 500 $WON</option><option value="paypal" ${window.PM==='paypal'?'selected':''}>PayPal — from 1,000 $WON</option></select>
<select id="a">${[500,1000,2500].map(p=>{const mn=window.PM==='paypal'?1000:500;return`<option value="${p}" ${p>b.available||p<mn?'disabled':''}>${usd(p)} — ${n(p)} ${U}</option>`}).join('')}</select>
<div class="row muted" style="margin:6px 0"><span>Fee</span><span>$0.00</span></div><div class="row muted" style="margin-bottom:10px"><span>Delivery</span><span>To ${esc(me().email)}, usually within 3 business days</span></div>
<button class="btn" style="width:100%" ${b.available>=API.MIN?'':'disabled'} onclick="LIVE.payout($('#a').value,$('#m').value)">Request cash-out</button>
<p class="muted" style="margin-top:10px">500 ${U} = $5 gift card minimum · 1,000 ${U} = $10 PayPal minimum. Only Available ${U} can be cashed out (earnings unlock after a 14-day hold). Requires a verified email. Each request is reviewed by hand, then paid at full face value.</p></div>
<h2>Your cash-outs</h2>${L.payouts.length?L.payouts.map(r=>`<div class="card row"><div><b>${usd(r.amount_won)} ${r.method==='paypal'?'PayPal':'gift card'}</b><div class="muted">${new Date(r.created_at).toLocaleDateString()} · ${n(r.amount_won)} $WON</div></div><span class="${r.status==='paid'?'pos':r.status==='rejected'?'neg':'pend'}">${{requested:'⏳ Requested',approved:'✓ Approved',paid:'✅ Paid',rejected:'Refunded'}[r.status]}</span></div>`).join(''):'<p class="muted">None yet</p>'}${liveFunded}`},
 history(){const g=gate();if(g)return g;return`<h1>History</h1>`+ledgerList(L.ledger)},
 tasks(){return`<h1>Tasks</h1><div class="card note">Daily tasks are coming soon. For now, earn ${U} from <a href="#offers">surveys</a>.</div>`},
 referral(){return`<h1>Referral</h1><div class="card note">Referral rewards are coming soon.</div>`},
 account(){const g=gate();if(g)return g;return`<h1>Account</h1><div class="card"><b>${esc(me().email)}</b><div class="muted">Member since ${new Date(L.profile.created_at).toLocaleDateString()} · ${me().email_confirmed_at?'✓ Email verified':'⚠️ Email not verified yet'}</div></div>
<div class="card"><a href="#history">Transaction history →</a></div><div class="card"><a href="#redeem">Cash out →</a></div>${L.profile.is_admin?'<div class="card"><a href="#admin">🔐 Owner admin →</a></div>':''}
<div class="card"><b>Set / change password</b><input id="np" type="password" autocomplete="new-password" placeholder="New password (8+ characters)"><button class="btn sm" onclick="LIVE.setPw($('#np').value)">Save password</button></div>
<div class="card"><a href="#about">About / How it works</a> · <a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a> · <a href="mailto:solodolobiz4@gmail.com">Support</a></div>
<div class="card muted">No premium tiers. Everyone earns at the same rate. Cosmetics never change $WON earnings. 18+ only. To delete your account, email support.</div><button class="btn ghost" onclick="LIVE.signOut()">Sign out</button>`},
 admin(){const g=gate();if(g)return g;if(!L.profile.is_admin)return'<h1>Owner admin</h1><div class="card note">Owner only.</div>';if(!L.admin&&!L.adminErr)LIVE.admin();
  if(L.adminErr)return`<h1>Owner admin</h1><div class="card note">${esc(L.adminErr)}</div>`;if(!L.admin)return'<h1>Owner admin</h1><p class="muted">Loading…</p>';const s=L.admin.sum,m=x=>'$'+Number(x).toFixed(2);
  return`<h1>Owner admin 🔐</h1><div class="card">${[['Partner cash received',m(s.receipts_usd)],['Payout headroom (received − requested/paid)',m(s.headroom_usd)],['Paid out',m(s.paid_usd)],['Open requests',s.open_requests],['Members',s.members],['User $WON available / pending',n(s.available_won)+' / '+n(s.pending_won)]].map(([k,x])=>`<div class="row muted"><span>${k}</span><b>${x}</b></div>`).join('')}</div>
<div class="card"><b>Record partner money received</b><p class="muted">Only enter cash that actually landed in your bank/PayPal from CPX. Cash-outs are allowed only up to this amount.</p><input id="ru" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="USD received, e.g. 25.00"><input id="rn" placeholder="Note (e.g. CPX invoice Oct 2026)"><button class="btn sm" onclick="if(confirm('Record $'+$('#ru').value+' received from CPX? This cannot be edited later.'))LIVE.addReceipt($('#ru').value,$('#rn').value)">Record receipt</button></div>
<div class="row"><h2>Cash-out requests</h2><button class="btn sm ghost" onclick="LIVE.admin()">Refresh</button></div>
${L.admin.rows.length?L.admin.rows.map(r=>`<div class="card"><div class="row"><b>#${r.id} · ${m(r.usd)} ${r.method==='paypal'?'PayPal':'gift card'}</b><span class="${r.status==='paid'?'pos':r.status==='rejected'?'neg':'pend'}">${r.status}</span></div><div class="muted">${esc(r.email)} · ${new Date(r.created_at).toLocaleString()}${r.provider_ref?' · ref '+esc(r.provider_ref):''}</div>
${['requested','approved'].includes(r.status)?`<div class="row" style="gap:6px;margin-top:8px">${r.status==='requested'?`<button class="btn sm ghost" onclick="LIVE.setPayout(${r.id},'approved')">Approve</button>`:''}<button class="btn sm" onclick="const ref=prompt('Mark #${r.id} PAID. Optional reference (e.g. Tremendous order id):','');if(ref!==null)LIVE.setPayout(${r.id},'paid',ref)">Mark paid</button><button class="btn sm ghost" onclick="if(confirm('Reject #${r.id} and refund the $WON to the member?'))LIVE.setPayout(${r.id},'rejected')">Reject + refund</button></div>`:''}</div>`).join(''):'<p class="muted">No requests yet.</p>'}
<p class="muted">Pay each request yourself (e.g. Tremendous gift card / PayPal to the email shown), then tap Mark paid.</p>`}};
if(!DEMO){Object.assign(views,LV);LIVE.init();render();}

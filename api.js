// Mock backend for Zynwin. All money rules live here; persisted to localStorage.
// Core rule: the owner never promises cash they don't have.
//  - Offer earnings are PENDING until the partner confirms & pays, then AVAILABLE.
//  - Free tasks/referrals are paid from a capped BONUS BUDGET (a % of revenue actually received).
//  - Redemptions can't exceed cash on hand (partner revenue received - payouts already made).
const API=(()=>{const K='zynwin-v2',RATE=1000,MIN=5000,U='$WON!!🤩🤩🥳🥳',
BONUS_PCT=0.10,BONUS_CAP=50,CONFIRM_MS=30000;
const OFFERS=[
{id:'o1',kind:'Survey',icon:'📝',partner:'CPX Research',title:'Shopping habits survey',mins:8,payout:1.40,share:0.6},
{id:'o6',kind:'Survey',icon:'📝',partner:'BitLabs',title:'Tech products survey',mins:15,payout:2.20,share:0.6},
{id:'o2',kind:'App install',icon:'📲',partner:'AdGate Media',title:'Install FitTrack & open it',mins:3,payout:0.60,share:0.5},
{id:'o3',kind:'Game goal',icon:'🎮',partner:'Ayet Studios',title:'Reach level 10 in Tile Quest',mins:45,payout:6.00,share:0.55},
{id:'o7',kind:'Game goal',icon:'🎮',partner:'AdGate Media',title:'Build a Level 5 castle in Kingdoms',mins:150,payout:14.00,share:0.55},
{id:'o4',kind:'Cashback',icon:'🛍️',partner:'BitLabs Shopping',title:'ShoeHub purchase (8% back on $50)',mins:10,payout:4.00,share:0.6},
{id:'o5',kind:'Video ad',icon:'🎬',partner:'AdMob rewarded',title:'Watch a 30s video ad',mins:0.5,payout:0.02,share:0.5}];
const STREAK=[[7,0.10],[5,0.05],[3,0.02]];
const TASKS=[{id:'checkin',name:'Daily check-in',pts:10,daily:true,desc:'Open the app once a day'},
{id:'poll',name:'Quick poll',pts:5,daily:true,desc:'One tap question'},
{id:'tutorial',name:'Watch tutorial',pts:20,daily:false,desc:'2-minute video, one time only'},
{id:'invite',name:'Invite a friend',pts:100,daily:false,desc:'Paid when your friend\'s first offer is confirmed (single level)'}];
const today=()=>new Date().toISOString().slice(0,10),userPts=o=>Math.round(o.payout*o.share*RATE),perHour=o=>userPts(o)/RATE/(o.mins/60);
const fresh=()=>({user:{name:'Alex',code:'ZYN'+Math.floor(Math.random()*900+100)},done:{},tx:[],referrals:[],
 owner:{revenue:0,paidOut:0,bonusSpent:0,streakSpent:0},offerDays:[]});
let s=JSON.parse(localStorage.getItem(K)||'null')||fresh();const save=()=>localStorage.setItem(K,JSON.stringify(s));
const tx=(o)=>{s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),...o});save();};
const bonusBudget=()=>Math.min(s.owner.revenue*BONUS_PCT,BONUS_CAP);
const bonusLeft=()=>Math.max(0,bonusBudget()-s.owner.bonusSpent);
// Bonus items wait in pending until the bonus budget can cover them.
function settleBonuses(){s.tx.slice().reverse().forEach(t=>{if(t.source==='bonus'&&t.status==='pending'){const usd=t.pts/RATE;
 if(usd<=bonusLeft()+1e-9){s.owner.bonusSpent+=usd;t.status='available';}}});}
const dayStr=ms=>new Date(ms).toISOString().slice(0,10);
function streak(){const d=new Set(s.offerDays||[]);let n=0,ms=Date.now();if(!d.has(dayStr(ms)))ms-=864e5;while(d.has(dayStr(ms))){n++;ms-=864e5;}return n;}
const streakPct=()=>{const n=streak();return(STREAK.find(([k])=>n>=k)||[0,0])[1];};
function confirm(t){if(t.status!=='pending'||t.source!=='offer')return;t.status='available';s.owner.revenue+=t.partnerUsd;
 s.offerDays=s.offerDays||[];const d=dayStr(t.doneAt||Date.now());if(!s.offerDays.includes(d))s.offerDays.push(d);
 // Streak bonus comes out of the OWNER's share of this offer, so total paid never exceeds partner revenue.
 const pct=streakPct(),ownerShare=t.partnerUsd-t.pts/RATE,bonus=Math.min(Math.round(t.pts*pct),Math.floor(ownerShare*RATE));
 if(bonus>0){s.owner.streakSpent=(s.owner.streakSpent||0)+bonus/RATE;s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),type:'earn',source:'streak',status:'available',pts:bonus,label:`🔥 ${streak()}-day streak +${pct*100}%`});}
 const r=s.referrals.find(r=>r.pending);if(r){r.pending=false;}settleBonuses();}
function tick(){const now=Date.now();s.tx.forEach(t=>{if(t.source==='offer'&&t.status==='pending'&&now>=t.confirmAt)confirm(t);});settleBonuses();save();}
const sum=st=>s.tx.filter(t=>t.status===st&&t.pts>0).reduce((a,t)=>a+t.pts,0);
const balances=()=>{tick();const spent=-s.tx.filter(t=>t.type==='redeem').reduce((a,t)=>a+t.pts,0);
 return{pending:sum('pending'),available:sum('available')-spent};};
const avail=t=>t.id==='invite'||(t.daily?s.done[t.id]!==today():!s.done[t.id]);
return{RATE,MIN,U,userPts,state:()=>s,balances,
streak,streakPct,STREAK,
offers(){const L=OFFERS.map(o=>({...o,userPts:userPts(o),userUsd:userPts(o)/RATE,perHour:perHour(o)})).sort((x,y)=>(x.kind==='Cashback')-(y.kind==='Cashback')||y.perHour-x.perHour);
 L.forEach((o,i)=>o.top=i<2&&o.kind!=='Cashback'); /* purchase-required offers never top picks */return L;},
tasks:()=>TASKS.map(t=>({...t,available:avail(t)})),
owner(){tick();const b=balances(),cash=s.owner.revenue-s.owner.paidOut;
 return{...s.owner,cash,liability:(b.available+b.pending)/RATE,totalUserCredit:s.tx.filter(t=>t.pts>0&&t.status!=='pending').reduce((x,t)=>x+t.pts,0)/RATE,availableLiability:b.available/RATE,bonusBudget:bonusBudget(),bonusLeft:bonusLeft()};},
startOffer(id,{delay=CONFIRM_MS}={}){const o=OFFERS.find(x=>x.id===id);
 tx({type:'earn',source:'offer',status:'pending',pts:userPts(o),partnerUsd:o.payout,label:`${o.icon} ${o.title}`,partner:o.partner,doneAt:Date.now(),confirmAt:Date.now()+delay});},
confirmNow(id){const t=s.tx.find(x=>x.id===id);if(t)confirm(t);save();}, // demo: simulate partner postback
complete(id){const t=TASKS.find(x=>x.id===id);if(!t||!avail(t))throw Error('Already done today');if(id==='invite')throw Error('Use the Referral tab');
 s.done[id]=t.daily?today():true;tx({type:'earn',source:'bonus',status:'pending',pts:t.pts,label:t.name});settleBonuses();save();},
referFriend(name){if(!name)throw Error('Enter a name');s.referrals.push({name,at:today(),pending:true});
 tx({type:'earn',source:'bonus',status:'pending',pts:100,label:'Referral bonus: '+name});settleBonuses();save();},
redeem(pts,brand){pts=+pts;const b=balances(),usd=pts/RATE;
 if(pts<MIN)throw Error(`Minimum is ${MIN.toLocaleString()} ${U}`);
 if(pts>b.available)throw Error(`Only Available ${U} can be redeemed. Pending ones unlock when partners confirm.`);
 if(usd>s.owner.revenue-s.owner.paidOut+1e-9)throw Error('Payout processing — funds are arriving from partners. Your balance is safe; please try again soon.');
 s.owner.paidOut+=usd;tx({type:'redeem',status:'paid',pts:-pts,label:`$${usd.toFixed(2)} ${brand} gift card (no fee)`});},
seed(){if(s.tx.length)return;const p=(id,ago)=>{this.startOffer(id,{delay:0});s.tx[0].at=new Date(Date.now()-ago).toISOString();s.tx[0].doneAt=Date.now()-ago;tick();};
 ['o3','o1','o4','o2','o6'].forEach((id,i)=>p(id,86400000*(4-i)));
 this.complete('checkin');this.complete('tutorial');this.referFriend('Sam');
 this.startOffer('o1',{delay:3600000});this.startOffer('o5',{delay:3600000});},
reset(){localStorage.removeItem(K);s=fresh();save();}};})();

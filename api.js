// Mock backend for Joker's Abstract Wins (formerly Zynwin). All money rules live here; persisted to localStorage.
// Core rule: the owner never promises cash they don't have.
//  - Offer earnings are PENDING until the partner confirms & pays, then AVAILABLE.
//  - Free tasks/referrals are paid from a capped BONUS BUDGET (a % of revenue actually received).
//  - Redemptions can't exceed cash on hand (partner revenue received - payouts already made).
const API=(()=>{const K='jaw-v1',RATE=1000,MIN=5000,U='$WON!!🤩🤩🥳🥳',
BONUS_PCT=0.10,BONUS_CAP=50,CONFIRM_MS=30000;
const OFFERS=[
{id:'o8',kind:'Game goal',icon:'🎮',partner:'Torox',title:'Reach level 15 in Merge Garden',mins:60,payout:7.50,share:0.55},
{id:'o9',kind:'Survey',icon:'📝',partner:'Torox',title:'Lifestyle survey',mins:12,payout:1.80,share:0.6},
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
 owner:{revenue:0,partnerRevenue:0,shopRevenue:0,paidOut:0,bonusSpent:0,streakSpent:0,boosterSpent:0},offerDays:[],xp:0,xpSpent:0,boosters:[],milestones:{},games:{},owned:['th-default','av-joker','cb-classic'],equip:{theme:'th-default',avatar:'av-joker',cardback:'cb-classic'}});
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
 s.owner.partnerRevenue=(s.owner.partnerRevenue||0)+t.partnerUsd;addXp(Math.round(t.pts/10));
 const pct=streakPct();let room=Math.floor((t.partnerUsd-t.pts/RATE)*RATE+1e-6);const bonus=Math.min(Math.round(t.pts*pct),room);room-=Math.max(bonus,0);
 const bp=activeBoosters().filter(b=>b.pct).reduce((x,b)=>x+b.pct,0),boost=Math.min(Math.round(t.pts*bp),room);
 if(boost>0){s.owner.boosterSpent=(s.owner.boosterSpent||0)+boost/RATE;s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),type:'earn',source:'booster',status:'available',pts:boost,label:`🚀 Booster +${Math.round(bp*100)}% (from our share)`});}
 if(bonus>0){s.owner.streakSpent=(s.owner.streakSpent||0)+bonus/RATE;s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),type:'earn',source:'streak',status:'available',pts:bonus,label:`🔥 ${streak()}-day streak +${pct*100}%`});}
 const r=s.referrals.find(r=>r.pending);if(r){r.pending=false;}settleBonuses();}
function tick(){const now=Date.now();s.tx.forEach(t=>{if(t.source==='offer'&&t.status==='pending'&&now>=t.confirmAt)confirm(t);});checkMilestones();settleBonuses();save();}
// ---- XP, levels, boosters, milestones, games, shop ----
const LEVELS=[0,50,150,300,600,1000,1600,2500,4000];
const isWeekend=(d=new Date())=>[0,6].includes(d.getUTCDay());
const weekendEnd=()=>{const d=new Date();d.setUTCHours(24,0,0,0);while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()+1);return d.getTime();};
function addXp(n){s.xp=(s.xp||0)+n*(isWeekend()?2:1);}
const level=()=>{let l=1;LEVELS.forEach((x,i)=>{if((s.xp||0)>=x)l=i+1});return{level:l,xp:s.xp||0,next:LEVELS[l]||null,prev:LEVELS[l-1]};};
function activeBoosters(){const now=Date.now(),L=(s.boosters||[]).filter(b=>b.endsAt>now);
 if(isWeekend())L.push({id:'wk',name:'2X XP Weekend',xp2:true,endsAt:weekendEnd(),badge:'2X WEEKEND',desc:'Double XP on everything this weekend (XP only — never $WON).'});return L;}
function giveBooster(name,pct,hours){s.boosters=s.boosters||[];s.boosters.push({id:Math.random().toString(36).slice(2),name,pct,endsAt:Date.now()+hours*36e5,badge:'LIMITED TIME',desc:`+${pct*100}% on confirmed offer $WON, paid from our share of each offer (capped at what the partner pays us).`});}
const confirmedOffers=()=>s.tx.filter(t=>t.source==='offer'&&t.status==='available');
const MILESTONES=[
 {id:'m1',name:'First offer confirmed',icon:'🃏',test:()=>confirmedOffers().length>=1,reward:'50 XP + "Rookie Joker" badge',give:()=>{addXp(50);own('bd-rookie')}},
 {id:'m2',name:'3 offers confirmed',icon:'🎴',test:()=>confirmedOffers().length>=3,reward:'+10% booster for 24h',give:()=>giveBooster('+10% for 24h',0.10,24)},
 {id:'m3',name:'$1 earned from offers',icon:'💵',test:()=>confirmedOffers().reduce((x,t)=>x+t.pts,0)>=1000,reward:'20 $WON (bonus budget) + Neon Jester avatar',give:()=>{own('av-neon');bonusTx(20,'🏅 Milestone: $1 earned')}},
 {id:'m4',name:'3-day offer streak',icon:'🔥',test:()=>streak()>=3,reward:'25 $WON (bonus budget) + Prism card back',give:()=>{own('cb-prism');bonusTx(25,'🏅 Milestone: 3-day streak')}},
 {id:'m5',name:'Reach level 5',icon:'👑',test:()=>level().level>=5,reward:'+5% booster for 48h + Crown badge',give:()=>{giveBooster('+5% for 48h',0.05,48);own('bd-crown')}}];
function checkMilestones(){s.milestones=s.milestones||{};MILESTONES.forEach(m=>{if(!s.milestones[m.id]&&m.test()){s.milestones[m.id]=new Date().toISOString();m.give();}});}
function own(id){s.owned=s.owned||[];if(!s.owned.includes(id))s.owned.push(id);}
function bonusTx(pts,label){s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),type:'earn',source:'bonus',status:'pending',pts,label});}
// Mini-games: free to play, never paid. Prizes are small, capped per day, and only paid when the bonus budget can cover them.
const GAMES={scratch:{name:'Scratch Card',icon:'🎟️',table:[[1,0.50],[2,0.30],[5,0.15],[10,0.05]]},
 spin:{name:'Spin Wheel',icon:'🎡',table:[[1,0.25],[2,0.25],[3,0.125],[5,0.25],[10,0.125]]},
 flip:{name:'Card Flip Match',icon:'🃏',table:[[3,1]]}};
const GAME_PLAYS=5,GAME_DAILY_CAP=30;
function gameDay(){s.games=s.games||{};const d=today();if(s.games.day!==d)s.games={day:d,plays:{},won:0};return s.games;}
function playGame(id){const g=GAMES[id],gd=gameDay();let r=Math.random(),prize=g.table[g.table.length-1][0];
 for(const[p,odds]of g.table){if(r<odds){prize=p;break;}r-=odds;}
 gd.plays[id]=(gd.plays[id]||0)+1;addXp(5);
 let paid=0,why='';if(gd.plays[id]>GAME_PLAYS)why='Daily prize plays used — playing for XP.';
 else if(gd.won+prize>GAME_DAILY_CAP)why='Daily $WON cap reached — playing for XP.';
 else if(bonusLeft()<prize/RATE)why='Bonus budget is empty right now — playing for fun & XP.';
 else{paid=prize;gd.won+=prize;bonusTx(prize,`${g.icon} ${g.name} prize`);}
 checkMilestones();save();return{prize,paid,why};}
const SHOP=[
 {id:'th-default',type:'Theme',name:'Classic Felt',icon:'🟩',usd:0,xp:0},
 {id:'th-night',type:'Theme',name:'Midnight Joker',icon:'🌌',usd:1.99,xp:400},
 {id:'th-candy',type:'Theme',name:'Candy Abstract',icon:'🍬',usd:1.99,xp:400},
 {id:'av-joker',type:'Avatar',name:'Joker',icon:'🃏',usd:0,xp:0},
 {id:'av-neon',type:'Avatar',name:'Neon Jester',icon:'🤹',usd:0.99,xp:200},
 {id:'av-mask',type:'Avatar',name:'Masquerade',icon:'🎭',usd:0.99,xp:200},
 {id:'cb-classic',type:'Card back',name:'Classic',icon:'🂠',usd:0,xp:0},
 {id:'cb-prism',type:'Card back',name:'Prism',icon:'🔷',usd:0.99,xp:250},
 {id:'cb-swirl',type:'Card back',name:'Swirl',icon:'🌀',usd:0.99,xp:250},
 {id:'bd-rookie',type:'Badge',name:'Rookie Joker',icon:'🎖️',usd:null,xp:null},
 {id:'bd-crown',type:'Badge',name:'Crown',icon:'👑',usd:null,xp:null},
 {id:'bd-star',type:'Badge',name:'Starburst',icon:'🌟',usd:0.49,xp:100}];
// A sale is shown ONLY if the prior price was genuinely charged for 28+ days and the end date is real. None qualify yet (pre-launch).
const SALES={};
const sale=it=>{const x=SALES[it.id];return x&&Date.now()<x.endsAt&&x.priorSince<=Date.now()-28*864e5?x:null;};
const priceOf=it=>sale(it)?sale(it).usd:it.usd;
function buy(id,how){const it=SHOP.find(x=>x.id===id);if(!it)throw Error('Unknown item');if((s.owned||[]).includes(id))throw Error('Already owned');
 if(how==='xp'){if(it.xp==null)throw Error('Earned via milestones only');const lv=(s.xp||0)-(s.xpSpent||0);if(lv<it.xp)throw Error('Not enough XP');s.xpSpent=(s.xpSpent||0)+it.xp;}
 else{if(it.usd==null)throw Error('Earned via milestones only');const p=priceOf(it);s.owner.revenue+=p;s.owner.shopRevenue=(s.owner.shopRevenue||0)+p;
  s.tx.unshift({id:Math.random().toString(36).slice(2),at:new Date().toISOString(),type:'purchase',status:'paid',pts:0,usd:p,label:`🛒 Bought ${it.name} — $${p.toFixed(2)} (cosmetic)`});}
 own(id);save();}
function equip(id){const it=SHOP.find(x=>x.id===id);if(!(s.owned||[]).includes(id))throw Error('Not owned');s.equip=s.equip||{};
 s.equip[{Theme:'theme',Avatar:'avatar','Card back':'cardback',Badge:'badge'}[it.type]]=id;save();}
const sum=st=>s.tx.filter(t=>t.status===st&&t.pts>0&&t.type!=='purchase').reduce((a,t)=>a+t.pts,0);
const balances=()=>{tick();const spent=-s.tx.filter(t=>t.type==='redeem').reduce((a,t)=>a+t.pts,0);
 return{pending:sum('pending'),available:sum('available')-spent};};
const avail=t=>t.id==='invite'||(t.daily?s.done[t.id]!==today():!s.done[t.id]);
return{RATE,MIN,U,userPts,state:()=>s,balances,
streak,streakPct,STREAK,level,activeBoosters,MILESTONES,GAMES,GAME_PLAYS,GAME_DAILY_CAP,playGame,gameDay,SHOP,sale,priceOf,buy,equip,isWeekend,weekendEnd,
xpLeft:()=>(s.xp||0)-(s.xpSpent||0),
offers(){const L=OFFERS.map(o=>({...o,userPts:userPts(o),userUsd:userPts(o)/RATE,perHour:perHour(o)})).sort((x,y)=>(x.kind==='Cashback')-(y.kind==='Cashback')||y.perHour-x.perHour);
 L.forEach((o,i)=>o.top=i<2&&o.kind!=='Cashback'); /* purchase-required offers never top picks */return L;},
tasks:()=>TASKS.map(t=>({...t,available:avail(t)})),
owner(){tick();const b=balances(),cash=s.owner.revenue-s.owner.paidOut;
 return{...s.owner,cash,liability:(b.available+b.pending)/RATE,totalUserCredit:s.tx.filter(t=>t.pts>0&&t.status!=='pending').reduce((x,t)=>x+t.pts,0)/RATE,availableLiability:b.available/RATE,bonusBudget:bonusBudget(),bonusLeft:bonusLeft()};},
startOffer(id,{delay=CONFIRM_MS}={}){const o=OFFERS.find(x=>x.id===id);
 tx({type:'earn',source:'offer',status:'pending',pts:userPts(o),partnerUsd:o.payout,label:`${o.icon} ${o.title}`,partner:o.partner,doneAt:Date.now(),confirmAt:Date.now()+delay});},
confirmNow(id){const t=s.tx.find(x=>x.id===id);if(t)confirm(t);save();}, // demo: simulate partner postback
complete(id){const t=TASKS.find(x=>x.id===id);if(!t||!avail(t))throw Error('Already done today');if(id==='invite')throw Error('Use the Referral tab');
 s.done[id]=t.daily?today():true;addXp(5);tx({type:'earn',source:'bonus',status:'pending',pts:t.pts,label:t.name});settleBonuses();save();},
referFriend(name){if(!name)throw Error('Enter a name');s.referrals.push({name,at:today(),pending:true});
 tx({type:'earn',source:'bonus',status:'pending',pts:100,label:'Referral bonus: '+name});settleBonuses();save();},
redeem(pts,brand){pts=+pts;const b=balances(),usd=pts/RATE;
 if(pts<MIN)throw Error(`Minimum is ${MIN.toLocaleString()} ${U}`);
 if(pts>b.available)throw Error(`Only Available ${U} can be redeemed. Pending ones unlock when partners confirm.`);
 if(usd>s.owner.revenue-s.owner.paidOut+1e-9)throw Error('Payout processing — funds are arriving from partners. Your balance is safe; please try again soon.');
 s.owner.paidOut+=usd;tx({type:'redeem',status:'paid',pts:-pts,label:`$${usd.toFixed(2)} ${brand} gift card (no fee)`});},
seed(){if(s.tx.length)return;const p=(id,ago)=>{this.startOffer(id,{delay:0});s.tx[0].at=new Date(Date.now()-ago).toISOString();s.tx[0].doneAt=Date.now()-ago;tick();};
 ['o3','o1','o8','o2','o9'].forEach((id,i)=>p(id,86400000*(4-i)));
 this.complete('checkin');this.complete('tutorial');this.referFriend('Sam');
 this.startOffer('o1',{delay:3600000});this.startOffer('o5',{delay:3600000});this.playGame('scratch');this.playGame('spin');tick();},
reset(){localStorage.removeItem(K);s=fresh();save();}};})();

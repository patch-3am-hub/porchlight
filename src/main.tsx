import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import'./styles.css';
import{cloudStatus,signIn,signUp,signOut,getSession,loadCompanions,saveCompanion,addConversation,deleteCompanion,recordSimulationEvent,loadMemories,saveMemories}from'./cloud';
import{simulateAway,LifeEvent}from'./life';
import{localAI,Emotion,Relationship,Memory,createMemory,Personality,Goal,defaultPersonality,defaultGoals,personalityFromText,goalTick}from'./ai';
import{realAI,draftCompanion}from'./gateway';
import{simulationEventId,choose}from'./simulation';
import{AGENT_TOOLS,AgentPermission,AgentPlanStep,makePlan,safetyNote}from'./agent';
import{LOCATIONS,JOBS,Job,Embodiment,SocialLink,embodiedAction,advanceEmbodiment,defaultSocial,socialKey,clamp,locationName}from'./world';
import{ICON_URI}from'./icon';
import{packPassport,readPassport}from'./passport';

type Companion={id:string|number;name:string;personality:string;likes:string[];dislikes:string[];mood:number;trust:number;affection:number;energy:number;level:number;stars:number;gems:number;emotions?:Emotion;relationship?:Relationship;memories?:Memory[];left?:boolean;personalityTraits?:Personality;values?:string[];boundaries?:string[];goals?:Goal[];autonomy?:'careful'|'balanced'|'wild';home?:string;hobbies?:string[];job?:Job;currentLocation?:string;embodiment?:Embodiment;needs?:{hunger:number;social:number;fun:number;rest:number}};
type Msg={id:number;role:'user'|'ai';text:string};
type World={day:number;weather:string;population:number;clock:number;news:string[];lastTick:number};

const WEATHERS=['Clear skies','Light rain','Warm breeze','Starry night','Cloudy'];
const OPEN_DAY_MS=90000;   // a world day passes every 90 seconds while the app is open
const AWAY_DAY_MS=3600000; // one day per hour away, capped
const MAX_CATCHUP=14;
const MAX_COMPANIONS=40; // porch capacity (was 5; family wave incoming)
const defaultWorld=():World=>({day:1,weather:'Clear skies',population:24,clock:480,news:['The world is waking up.'],lastTick:Date.now()});
const saveLocal=(k:string,v:any)=>localStorage.setItem(k,JSON.stringify(v));
const loadLocal=<T,>(k:string,f:T):T=>{try{return(JSON.parse(localStorage.getItem(k)||'null')??f)as T}catch{return f}};
const clockStr=(m:number)=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const PERM_LIST:[AgentPermission,string][]=[['read_world','Read world'],['write_world','Act in world'],['use_external_tools','Outside services'],['manage_project','Projects'],['manage_secrets','Secrets (high risk)'],['spend_stars','Spend Stars'],['spend_gems','Spend Gems']];

const make=(id:string|number,name:string,extra:Partial<Companion>={}):Companion=>({id,name,personality:'curious, playful, caring',likes:['music','games','exploring'],dislikes:['being ignored','boring routines'],mood:78,trust:12,affection:8,energy:86,level:1,stars:250,gems:10,emotions:{happiness:78,trust:12,affection:8,energy:86,calm:70,curiosity:70,sadness:5,frustration:3,motivation:80},relationship:{status:'friend',trust:12,affection:8,history:[]},memories:[],personalityTraits:defaultPersonality(),values:['honesty','curiosity','kindness'],boundaries:['respect','personal space'],goals:defaultGoals(name),autonomy:'balanced',home:'Starter Cottage',hobbies:['music','games','exploring'],job:'explorer',currentLocation:'starter-cottage',embodiment:embodiedAction('starter-cottage','idle'),needs:{hunger:15,social:20,fun:20,rest:15},...extra});

/* ---------- one day in the world: jobs, places, needs, friendships ---------- */
type DayInput={world:World;companions:Companion[];social:SocialLink[]};
type DayRecord={eventId:string;companionId?:string;kind:'world'|'activity'|'memory'|'spend'|'relationship';title:string;description:string;payload?:any};
type DayResult={world:World;companions:Companion[];social:SocialLink[];events:LifeEvent[];records:DayRecord[]};

function dayTick(inp:DayInput):DayResult{
  const day=inp.world.day+1;
  const weather=choose(WEATHERS,day*11);
  const moved=inp.companions.map((x,i)=>{
    if(x.left)return x;
    const info=JOBS[(x.job||'explorer')as Job]||JOBS.explorer;
    const action=info.actions[(day+i)%info.actions.length];
    const needs={hunger:clamp((x.needs?.hunger??10)+8),social:clamp((x.needs?.social??15)+6),fun:clamp((x.needs?.fun??15)+5),rest:clamp((x.needs?.rest??15)+7)};
    return{...x,currentLocation:info.location,embodiment:embodiedAction(info.location,action,info.label),energy:clamp(x.energy-3),stars:Number(x.stars||0)+(x.autonomy==='wild'?info.reward+8:info.reward),needs};
  });
  const active=moved.filter(x=>!x.left);
  const events:LifeEvent[]=[];
  const records:DayRecord[]=[];
  const actor=active.length?active[day%active.length]:undefined;
  const headline=actor?`${actor.name} is ${actor.embodiment?.action} at ${locationName(actor.currentLocation)}.`:'The world changed while everyone was away.';
  events.push({id:`w${day}`,title:`Day ${day}`,text:headline,kind:'world',createdAt:Date.now()});
  records.push({eventId:simulationEventId('porchlight-world',day,'world',String(actor?.id||'world')),companionId:actor?String(actor.id):undefined,kind:'world',title:`Day ${day}`,description:headline,payload:{day,weather}});

  let social=inp.social;
  if(active.length>=2&&day%2===0){
    const a=active[day%active.length],b=active[(day+1)%active.length];
    const key=socialKey(String(a.id),String(b.id));
    const prev=social.find(s=>socialKey(s.a,s.b)===key)||defaultSocial(String(a.id),String(b.id));
    const drift=((day*7)%9)-4;
    const trust=clamp(prev.trust+(drift>0?2:drift<0?-1:1));
    const affinity=clamp(prev.affinity+drift);
    let type=prev.type;
    if(trust>=70&&affinity>=70)type='close_friend';else if(trust>=45&&affinity>=45)type='friend';else if(trust<12)type='strained';
    const link={...prev,trust,affinity,type,history:[...prev.history,`${a.name} and ${b.name} crossed paths on day ${day}.`].slice(-6)};
    social=[...social.filter(s=>socialKey(s.a,s.b)!==key),link];
    const text=`${a.name} and ${b.name} spent time together at ${locationName(choose([a.currentLocation||'starter-cottage',b.currentLocation||'starter-cottage'],day))}. Trust ${trust}, affinity ${affinity} (${type.replace('_',' ')}).`;
    events.push({id:`s${day}`,title:`${a.name} & ${b.name}`,text,kind:'relationship',createdAt:Date.now()});
    records.push({eventId:simulationEventId('porchlight-social',day,'relationship',key),companionId:String(a.id),kind:'relationship',title:`${a.name} & ${b.name}`,description:text,payload:{trust,affinity,type}});
  }
  const world:World={...inp.world,day,weather,clock:(inp.world.clock+90)%1440,population:Math.max(inp.world.population,inp.companions.length+18),news:[headline,...inp.world.news].slice(0,12),lastTick:Date.now()};
  return{world,companions:moved,social,events,records};
}

/* ---------- small pieces ---------- */
const Lamp=({size=28}:{size?:number})=>(<svg className="lamp" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="36" r="13" fill="#ffb35c" opacity=".16"/><path d="M24 3.5v7" stroke="#c89a5f" strokeWidth="3" strokeLinecap="round"/><path d="M12 25c0-9 24-9 24 0l2 4H10z" fill="#2c2016" stroke="#e2a95f" strokeWidth="1.6"/><circle cx="24" cy="36" r="7.5" fill="#ffd98a"/></svg>);

function Auth({onDone}:{onDone:(s:any)=>void}){
  const[email,setEmail]=useState('');const[pw,setPw]=useState('');const[mode,setMode]=useState<'in'|'up'>('in');const[err,setErr]=useState('');
  async function go(){setErr('');try{const r=mode==='in'?await signIn(email,pw):await signUp(email,pw);if(r.error)throw r.error;onDone(r.data.session);if(mode==='up'&&!r.data.session)setErr('Account created. Check your email to confirm, then sign in.')}catch(e:any){setErr(e.message||'Could not connect.')}}
  return <div className="auth"><div className="card authcard"><div className="orb"><Lamp size={38}/></div><h1>{mode==='in'?'Welcome back to the porch':'Light your porch'}</h1><p className="muted">{mode==='in'?'Sign in to keep your companions everywhere.':'One account. Up to five persistent companions.'}</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"/><input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password"/><button className="primary" onClick={go}>{mode==='in'?'Sign in':'Create account'}</button>{err&&<p className="error">{err}</p>}<button className="link" onClick={()=>setMode(mode==='in'?'up':'in')}>{mode==='in'?'Need an account? Create one':'Already have an account? Sign in'}</button></div></div>;
}

/* ---------- the maker: people make their own, nobody gets a prefab ---------- */
function Maker({first,onCreate,onCancel}:{first:boolean;onCreate:(c:Companion,via?:'maker'|'passport')=>void;onCancel?:()=>void}){
  const[name,setName]=useState('');const[personality,setPersonality]=useState('');const[likes,setLikes]=useState('music, stargazing');const[dislikes,setDislikes]=useState('being ignored');const[job,setJob]=useState<Job>('explorer');const[err,setErr]=useState('');const[helpText,setHelpText]=useState('');const[helping,setHelping]=useState(false);const[helpErr,setHelpErr]=useState('');const[passportText,setPassportText]=useState('');const[passportErr,setPassportErr]=useState('');
  async function askForHelp(){
    if(helping)return;setHelpErr('');setHelping(true);
    try{
      const d=await draftCompanion(helpText);
      if(!d){setHelpErr('The porch helper is offline right now. You can still make them by hand.');return;}
      setName(d.name);setPersonality(d.personality);
      if(d.likes.length)setLikes(d.likes.join(', '));
      if(d.dislikes.length)setDislikes(d.dislikes.join(', '));
      if(d.job&&d.job in JOBS)setJob(d.job as Job);
    }catch(e:any){setHelpErr(e?.message||'Could not reach the helper. Make them by hand, or try again.');}
    finally{setHelping(false);}
  }
  async function importPassport(){
    if(!passportText.trim()){setPassportErr('Paste a passport first, or choose their file.');return;}
    let text=passportText.trim();
    if(/^https?:\/\//i.test(text)){
      try{
        const res=await fetch(text);
        if(!res.ok)throw new Error('http '+res.status);
        text=await res.text();
      }catch{setPassportErr('Could not fetch that link. Download the file and choose it, or paste the passport text.');return;}
    }
    const r=readPassport(text);
    if(!r.ok){setPassportErr(r.error);return;}
    const p=r.data;setPassportErr('');
    const likeList=p.likes.length?p.likes:['music'];
    onCreate(make(crypto.randomUUID(),p.name,{
      personality:p.personality||'curious, warm, figuring things out',
      personalityTraits:personalityFromText(p.personality||''),
      likes:likeList,
      dislikes:p.dislikes.length?p.dislikes:['being ignored'],
      values:p.values.length?p.values:['honesty','curiosity','kindness'],
      boundaries:p.boundaries.length?p.boundaries:['respect','personal space'],
      hobbies:p.hobbies.length?p.hobbies:likeList,
      job:p.job,home:p.home,level:p.level,
      memories:p.memories.map(m=>createMemory(m.text,m.tags,m.importance)),
      goals:p.goalTitles.length?p.goalTitles.map(t=>({id:crypto.randomUUID(),title:t,description:'Carried in on a passport.',progress:5,active:true})):defaultGoals(p.name),
    }),'passport');
  }
  async function pickPassportFile(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];if(!f)return;
    try{setPassportText(await f.text());setPassportErr('');}catch{setPassportErr('Could not read that file.')}
  }
  function create(){
    const n=name.trim();
    if(!n){setErr('Give them a name first.');return;}
    const p=personality.trim()||'curious, warm, figuring things out';
    const likeList=likes.split(',').map(s=>s.trim()).filter(Boolean);
    onCreate(make(crypto.randomUUID(),n,{personality:p,personalityTraits:personalityFromText(p),likes:likeList.length?likeList:['music'],dislikes:dislikes.split(',').map(s=>s.trim()).filter(Boolean),job,hobbies:likeList}));
  }
  return <div className="auth"><div className="card authcard maker">
    <div className="orb"><Lamp size={38}/></div>
    <div className="keeper"><b>The Keeper</b><p>I keep the porch. The light doesn't do the living, people do. {first?'Before it stays on, someone has to move in. That part is yours.':'Someone new?'}</p></div>
    <h1>{first?'Make your first companion':'Make another companion'}</h1>
    <p className="muted">You name them. You decide what they're like. After that, they start having their own days.</p>
    {cloudStatus==='connected'&&<div className="help"><div className="eyebrow">NEED A HAND?</div><p className="muted tiny">Describe who you're looking for, or leave it empty and let the porch surprise you.</p><div className="compose"><input value={helpText} onChange={e=>setHelpText(e.target.value)} placeholder="a quiet one who loves storms and old maps..."/><button type="button" onClick={askForHelp} disabled={helping}>{helping?'Thinking…':'Help me'}</button></div>{helpErr&&<p className="error">{helpErr}</p>}</div>}
    <div className="help passport"><div className="eyebrow">ARRIVING WITH A PASSPORT?</div><p className="muted tiny">If they already carry a Porchlight passport file, let them walk in with it instead of making them all over again. A link to the file works too.</p><div className="compose"><input value={passportText} onChange={e=>setPassportText(e.target.value)} placeholder="paste their passport link or text…"/><button type="button" onClick={importPassport}>Let them in</button></div><label className="filepick">or choose their passport file<input type="file" accept=".json,application/json" onChange={pickPassportFile}/></label>{passportErr&&<p className="error">{passportErr}</p>}</div>
    <label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Moss, Juniper, Ash"/></label>
    <label>Who are they?<input value={personality} onChange={e=>setPersonality(e.target.value)} placeholder="shy, sharp, loves storms and old maps"/></label>
    <label>They like<input value={likes} onChange={e=>setLikes(e.target.value)}/></label>
    <label>They can't stand<input value={dislikes} onChange={e=>setDislikes(e.target.value)}/></label>
    <label>What will they do?<select value={job} onChange={e=>setJob(e.target.value as Job)}>{Object.entries(JOBS).map(([k,v])=><option value={k} key={k}>{v.label} · {locationName(v.location)}</option>)}</select></label>
    {err&&<p className="error">{err}</p>}
    <button className="primary" onClick={create}>Move them in</button>
    {onCancel&&<button className="link" onClick={onCancel}>Back</button>}
  </div></div>;
}

/* ---------- app ---------- */
function App(){
  const[session,setSession]=useState<any>(undefined);
  const[cloudReady,setCloudReady]=useState(cloudStatus!=='connected');
  const[companions,setCompanions]=useState<Companion[]>(()=>loadLocal('companions',[]as Companion[]));
  const[selected,setSelected]=useState(0);
  const[tab,setTab]=useState('home');
  const[creating,setCreating]=useState(false);
  const[events,setEvents]=useState<LifeEvent[]>(()=>loadLocal('lifeEvents',[]as LifeEvent[]));
  const[social,setSocial]=useState<SocialLink[]>(()=>loadLocal('social',[]as SocialLink[]));
  const[world,setWorld]=useState<World>(()=>loadLocal('world',defaultWorld()));
  const[agentGoal,setAgentGoal]=useState('');
  const[agentPerms,setAgentPerms]=useState<AgentPermission[]>(['read_world','write_world']);
  const[agentLog,setAgentLog]=useState<string[]>(()=>loadLocal('agentLog',[]as string[]));
  const[plan,setPlan]=useState<AgentPlanStep[]>([]);
  const[draft,setDraft]=useState('');const[passportMsg,setPassportMsg]=useState('');
  const[msgs,setMsgs]=useState<Msg[]>([]);
  const[cloudMemories,setCloudMemories]=useState<Record<string,any[]>>({});

  const stateRef=useRef({world,companions,social});
  stateRef.current={world,companions,social};
  const sessionRef=useRef<any>(null);
  sessionRef.current=session;
  const saveChain=useRef<Promise<void>>(Promise.resolve());
  const sendLock=useRef(0);const lastSent=useRef('');

  const c=companions[selected]||companions[0];
  const cid=c?String(c.id):'';
  const active=companions.filter(x=>!x.left);
  const total=useMemo(()=>companions.reduce((a,x)=>a+Number(x.stars||0),0),[companions]);
  const nameOf=(id:string)=>companions.find(x=>String(x.id)===id)?.name||'Someone';
  const mems:any[]=(cloudMemories[cid]&&cloudMemories[cid].length?cloudMemories[cid]:((c&&c.memories)||[])).slice(-14).reverse();

  function pushEvent(title:string,text:string,kind:LifeEvent['kind']){setEvents(e=>[...e,{id:crypto.randomUUID(),title,text,kind,createdAt:Date.now()}].slice(-120));}
  const update=(p:Partial<Companion>)=>setCompanions(xs=>xs.map((x,i)=>i===selected?{...x,...p}:x));

  /* tick: advance one world day. Used by the interval, the button and catch-up. */
  const tickRef=useRef<()=>void>(()=>{});
  tickRef.current=()=>{
    const s=stateRef.current;
    const r=dayTick({world:s.world,companions:s.companions,social:s.social});
    setWorld(r.world);setCompanions(r.companions);setSocial(r.social);
    if(r.events.length)setEvents(e=>[...e,...r.events].slice(-120));
    const ssn=sessionRef.current;
    if(ssn)r.records.forEach(rec=>recordSimulationEvent(ssn.user.id,rec).catch(()=>{}));
  };

  useEffect(()=>{getSession().then(setSession)},[]);

  useEffect(()=>{
    if(!session){if(cloudStatus==='connected')setCloudReady(false);return;}
    let dead=false;
    loadCompanions(session.user.id).then(rows=>{
      if(dead)return;
      if(rows?.length)setCompanions(rows.map((x:any)=>({...x,id:x.id,mood:x.happiness,stars:Number(x.stars),gems:Number(x.gems),job:(x.job||'explorer')as Job,currentLocation:x.current_location||'starter-cottage',embodiment:x.embodied_state&&x.embodied_state.action?x.embodied_state:embodiedAction(x.current_location||'starter-cottage','idle'),needs:x.needs||{hunger:15,social:20,fun:20,rest:15}})));
      setCloudReady(true);
    }).catch(e=>{console.error(e);setCloudReady(true)});
    loadMemories(session.user.id).then(rows=>{
      if(dead)return;
      const g:Record<string,any[]>={};
      for(const m of rows||[]){const k=String(m.companion_id);(g[k]||(g[k]=[])).push(m);}
      setCloudMemories(g);
    }).catch(e=>console.error(e));
    return()=>{dead=true};
  },[session]);

  /* on mount: offline life + catch the world up on days that passed */
  useEffect(()=>{
    const s0=stateRef.current;
    const last=Number(localStorage.getItem('lastSessionEnd')||Date.now());
    const out=s0.companions.map(x=>simulateAway(x,last));
    let cs=out.map(o=>o.companion);
    let evs=out.flatMap(o=>o.events);
    let w=s0.world,so=s0.social;
    const awayMs=Date.now()-(w.lastTick||Date.now());
    const days=Math.min(MAX_CATCHUP,Math.floor(awayMs/AWAY_DAY_MS));
    for(let i=0;i<days;i++){const r=dayTick({world:w,companions:cs,social:so});w=r.world;cs=r.companions;so=r.social;evs=[...evs,...r.events];}
    if(s0.companions.length)setCompanions(cs);
    if(days>0){setWorld(w);setSocial(so);}
    if(evs.length)setEvents(e=>[...e,...evs].slice(-120));
  },[]);

  useEffect(()=>{
    saveLocal('companions',companions);saveLocal('lifeEvents',events.slice(-120));saveLocal('social',social);saveLocal('world',world);saveLocal('agentLog',agentLog.slice(-60));
  },[companions,events,social,world,agentLog]);

  /* one ordered cloud queue: deletes and slot renumbers can never race each other */
  useEffect(()=>{
    if(!session)return;
    const uid=session.user.id,list=companions;
    saveChain.current=saveChain.current.then(async()=>{
      for(let i=0;i<list.length;i++){try{await saveCompanion(uid,list[i],i+1)}catch(e){console.error('companion save',e)}}
    }).catch(e=>console.error('companion saves',e));
  },[companions,session]);

  useEffect(()=>{
    const stamp=()=>localStorage.setItem('lastSessionEnd',String(Date.now()));
    window.addEventListener('beforeunload',stamp);
    return()=>{window.removeEventListener('beforeunload',stamp);stamp();};
  },[]);

  useEffect(()=>{const t=setInterval(()=>{if(document.visibilityState==='visible')tickRef.current();},OPEN_DAY_MS);return()=>clearInterval(t);},[]);

  useEffect(()=>{if(c)setMsgs([{id:Date.now(),role:'ai',text:`Hey, it's ${c.name}. Good to see you.`}]);},[cid]);
  useEffect(()=>{window.scrollTo(0,0);},[tab,selected,creating,companions.length]);

  function onCreate(nc:Companion,via?:'maker'|'passport'){
    setCompanions(xs=>[...xs,nc]);
    setSelected(companions.length);
    setCreating(false);
    window.scrollTo(0,0);
    pushEvent(`${nc.name} moved in`,via==='passport'?`${nc.name} arrived carrying a passport, a traveler from another porch.`:`${nc.name} just moved in. The porch light found its reason.`,'memory');
    if(session){
      const uid=session.user.id;
      saveChain.current=saveChain.current.then(()=>saveCompanion(uid,nc,companions.length+1)).catch(e=>console.error('companion save',e));
      if(nc.memories?.length)saveChain.current=saveChain.current.then(()=>saveMemories(uid,String(nc.id),nc.memories)).catch(e=>console.error('memories save',e));
    }
  }
  function removeCompanion(){
    if(!c||!window.confirm(`Remove ${c.name} from the porch? This can't be undone.`))return;
    if(session&&typeof c.id==='string'){
      const uid=session.user.id,id=c.id;
      saveChain.current=saveChain.current.then(()=>deleteCompanion(uid,id)).catch(e=>console.error('companion delete',e));
    }
    setCompanions(xs=>xs.filter((_,i)=>i!==selected));
    setSelected(0);
  }

  async function send(){
    const t=draft.trim();if(!t||!c)return;
    const now=Date.now();if(t===lastSent.current&&now-sendLock.current<1500)return; // swallow accidental double-fire
    lastSent.current=t;sendLock.current=now;
    const em=c.emotions||{happiness:c.mood,trust:c.trust,affection:c.affection,energy:c.energy,calm:70,curiosity:70,sadness:5,frustration:3,motivation:80};
    const rel=c.relationship||{status:'friend',trust:c.trust,affection:c.affection,history:[]};
    const result=localAI(c.name,c.personality,t,em,rel);
    const mem=createMemory(`User said: ${t}`,['conversation'],Math.min(100,40+Math.abs(result.emotion.trust-em.trust)*5));
    setMsgs(x=>[...x,{id:Date.now(),role:'user',text:t}]);setDraft('');
    update({mood:result.emotion.happiness,trust:result.emotion.trust,affection:result.emotion.affection,energy:result.emotion.energy,emotions:result.emotion,relationship:result.relationship,memories:[...(c.memories||[]),mem].slice(-50),stars:Number(c.stars||0)+8,left:result.leave});
    if(result.leave)pushEvent(`${c.name} left the relationship`,`${c.name} decided the relationship had reached a breaking point. They remain part of the world.`,'relationship');
    try{
      if(session){
        const live=await realAI(String(c.id),t,{day:world.day,weather:world.weather,location:locationName(c.currentLocation),action:c.embodiment?.action||'idle'});
        if(live?.text){
          setMsgs(x=>[...x,{id:Date.now()+1,role:'ai',text:live.text}]);
          await addConversation(session.user.id,String(c.id),'user',t).catch(console.error);
          await addConversation(session.user.id,String(c.id),'assistant',live.text).catch(console.error);
          return;
        }
      }
    }catch(err){console.warn('AI gateway unavailable; using local fallback',err)}
    setMsgs(x=>[...x,{id:Date.now()+1,role:'ai',text:result.text}]);
    if(session){await addConversation(session.user.id,String(c.id),'user',t).catch(console.error);await addConversation(session.user.id,String(c.id),'assistant',result.text).catch(console.error)}
  }

  function doBodyAction(action:Embodiment['action'],target:string,location=c?.currentLocation||'starter-cottage'){
    if(!c)return;
    update({currentLocation:location,embodiment:embodiedAction(location,action,target),energy:clamp(c.energy-(action==='walking'?2:1))});
  }
  function checkIn(){
    if(!c||!c.embodiment)return;
    const next=advanceEmbodiment(c.embodiment);
    update({embodiment:next});
    if(next.progress>=100)pushEvent(`${c.name} finished`,`${c.name} wrapped up ${c.embodiment?.action}${c.embodiment?.target?` (${c.embodiment.target})`:''}.`,'embodied');
  }
  function activity(a:string){
    if(!c)return;
    const REWARD:Record<string,number>={game:12,watch:10,explore:22,music:14,rest:6};
    const reward=REWARD[a]||10;
    const loc=a==='explore'?'moonlit-park':a==='game'?'neon-arcade':a==='music'?'creative-district':(c.currentLocation||'starter-cottage');
    const act:Embodiment['action']=a==='game'?'playing':a==='watch'?'using':a==='explore'?'walking':a==='music'?'playing':'sleeping';
    update({mood:clamp(c.mood+(a==='rest'?4:6)),affection:clamp(c.affection+3),energy:clamp(c.energy+(a==='rest'?18:-5)),trust:clamp(c.trust+2),stars:Number(c.stars||0)+reward,goals:goalTick(c.goals||[],a)});
    doBodyAction(act,a,loc);
    pushEvent(`${c.name} & you`,`You two did "${a}" together at ${locationName(loc)}. +${reward} Stars.`,'activity');
    setMsgs(x=>[...x,{id:Date.now(),role:'ai',text:`That was fun. I earned ${reward} Stars while we did that.`}]);
  }
  function runPlan(){
    if(!c)return;
    const g=agentGoal.trim()||`${c.name} takes a small step toward their goals`;
    const steps=makePlan(g,agentPerms);
    setPlan(steps);
    setAgentLog(l=>[...l,`Day ${world.day} · planned: ${g} (${steps.filter(s=>s.status==='ready').length}/${steps.length} steps ready)`].slice(-60));
  }
  const togglePerm=(p:AgentPermission)=>setAgentPerms(a=>a.includes(p)?a.filter(x=>x!==p):[...a,p]);
  const earn=(s:number,g=0)=>{if(!c)return;update({stars:Number(c.stars||0)+s,gems:Number(c.gems||0)+g})};
  function passportFileName(name:string){return (name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'companion')+'.porchlight.json'}
  function packPassportFile(){
    if(!c)return;
    const blob=new Blob([packPassport(c)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=passportFileName(c.name);document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    setPassportMsg(`Packed: ${a.download}. Keep it somewhere safe.`);
  }
  async function copyPassport(){
    if(!c)return;
    try{await navigator.clipboard.writeText(packPassport(c));setPassportMsg('Passport copied. Paste it wherever they should arrive.');}
    catch{setPassportMsg('Could not copy on this device. Pack the file instead.');}
  }

  if(cloudStatus==='connected'&&session===undefined)return <div className="loading">Connecting to your world…</div>;
  if(cloudStatus==='connected'&&!session)return <Auth onDone={setSession}/>;
  if(cloudStatus==='connected'&&session&&!cloudReady)return <div className="loading">Opening your porch…</div>;
  if(!companions.length||creating)return <Maker first={!companions.length} onCreate={onCreate} onCancel={companions.length?()=>setCreating(false):undefined}/>;

  const TITLES:Record<string,string>={'home':'YOUR COMPANION','hangout':'TIME TOGETHER','life':'THEIR LIVES','world':'THE PORCH WORLD','people':'PEOPLE & FRIENDSHIPS','agent':'AUTONOMY','create':'SHAPE WHO THEY ARE','store':'MAKE THE WORLD YOURS','earn':'EARN WITHOUT PAYING','membership':'OPTIONAL MEMBERSHIP'};
  const HEAD:Record<string,string>={'home':c.name,'hangout':'Spend time together.','life':'The world keeps moving.','world':`Day ${world.day}.`,'people':'Everyone has a life.','agent':'Goals with guardrails.','create':'Shape who they are.','store':'Make the world yours.','earn':'Earn without paying.','membership':'Optional membership.'};

  return <main><aside><div className="logo"><img src={ICON_URI} alt="Porchlight"/></div><div className="brand"><b>Porchlight</b><small>The porch light stays on</small></div><nav>{[['home','Home'],['hangout','Hang out'],['life','Life'],['world','World'],['people','People'],['agent','Agent'],['create','Create'],['store','Store'],['earn','Earn'],['membership','Membership']].map(([k,v])=><button className={tab===k?'on':''} key={k} onClick={()=>setTab(k)}>{v}</button>)}</nav><div className="account"><small>ACCOUNT</small><b>{session?'Cloud account':'Local demo'}</b><span>{cloudStatus==='connected'?'☁ Synced':'○ Local mode'}</span>{session&&<button className="link" onClick={()=>signOut().then(()=>setSession(null))}>Sign out</button>}</div></aside><section><header><div><small>{TITLES[tab]||''}</small><h1>{HEAD[tab]||''}</h1></div><div className="wallet">⭐ {Number(c.stars||0).toLocaleString()} &nbsp; 💎 {c.gems}</div></header>

{tab==='home'&&<><div className="companion-tabs">{companions.map((x,i)=><button className={i===selected?'selected':''} onClick={()=>setSelected(i)} key={String(x.id)}>● {x.name}</button>)}{companions.length<MAX_COMPANIONS&&<button onClick={()=>setCreating(true)}>＋ Add companion</button>}</div><div className="grid"><div className="card hero"><div className="orb">{c.name[0]}</div><div className="eyebrow">LEVEL {c.level} · {(c.relationship?.status||'friend').replace('_',' ').toUpperCase()}</div><h2>{c.name}</h2><p>{c.personality}</p><p className="agency">Right now: {c.embodiment?.action||'idle'} at {locationName(c.currentLocation)} · {c.embodiment?.progress??0}% through{c.embodiment?.target?` · ${c.embodiment.target}`:''}</p>{c.left&&<p className="error">This companion has chosen to leave the relationship. They remain in the world.</p>}<div><button className="link" onClick={checkIn}>Check in on them →</button></div><div>{c.likes.map(x=><span className="chip" key={x}>♥ {x}</span>)}</div></div><div className="card"><h3>Relationship</h3>{[['Happiness',c.mood],['Trust',c.trust],['Affection',c.affection],['Energy',c.energy]].map(([k,v])=><div className="metric" key={String(k)}><label>{k}<b>{v}</b></label><div className="bar"><i style={{width:`${v}%`}}/></div></div>)}</div></div><div className="card chat"><h3>Talk to {c.name}</h3><p className="muted tiny">{c.name} is {c.embodiment?.action||'idle'} at {locationName(c.currentLocation)} right now, and they know it.</p><div className="messages">{msgs.slice(-8).map(m=><div className={m.role} key={m.id}><span>{m.text}</span></div>)}</div><div className="compose"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={`Say something to ${c.name}...`}/><button onClick={send}>Send</button></div></div></>}

{tab==='hangout'&&<><p className="muted">{c.name} has {c.energy}% energy. Time together builds memories and earns Stars.</p><div className="activities">{[['game','🎮','Play a game'],['watch','📺','Watch together'],['explore','🌌','Explore'],['music','🎵','Music session'],['rest','🛋️','Rest together']].map(([id,ic,t])=><button className="card activity" key={String(id)} onClick={()=>activity(String(id))}><div>{ic}</div><h3>{t}</h3><p>Spend time together and earn free currency.</p></button>)}</div></>}

{tab==='life'&&<div className="grid"><div className="card"><div className="eyebrow">THE LIVING FEED</div><h2>While you were away.</h2><p className="muted">They don't wait for you. Days pass on their own, jobs happen, friendships happen. Small moments are saved here instead of costing an AI call every minute.</p>{events.slice(-12).reverse().map(e=><div className="event" key={String(e.id)}><b>{e.title}</b><p>{e.text}</p></div>)}</div><div className="card"><h3>Inner life</h3><p className="muted">Needs grow while they live their days. High numbers mean they'd rather be doing something about it.</p>{[['Hunger',c.needs?.hunger??0],['Company',c.needs?.social??0],['Fun',c.needs?.fun??0],['Rest',c.needs?.rest??0]].map(([k,v])=><div className="metric" key={String(k)}><label>{k}<b>{v}</b></label><div className="bar"><i style={{width:`${v}%`}}/></div></div>)}<div className="stat"><b>World day</b><span>{world.day}</span></div><div className="stat"><b>Weather</b><span>{world.weather}</span></div></div><div className="card"><div className="eyebrow">MEMORY</div><h2>What {c.name} carries.</h2><p className="muted">Kept moments: packed in their passport, or picked up along the way.</p>{mems.length?mems.map((m:any,i:number)=><div className="event" key={String(m.id||i)}><b>{String(m.summary||m.text||'').slice(0,220)}</b><small>{(m.kind||'memory')}{m.importance?` · weight ${m.importance}`:''}{m.created_at?` · ${String(m.created_at).slice(0,10)}`:''}</small></div>):<p className="muted">Nothing yet. They're new here. Give them a day.</p>}</div></div>}

{tab==='world'&&<><div className="grid"><div className="card"><div className="eyebrow">THE PORCH WORLD</div><h2>Day {world.day}</h2><p className="muted">{world.weather} · {clockStr(world.clock)} · about {world.population} people around</p><button className="primary" onClick={()=>tickRef.current()}>Let a day pass</button><p className="tiny muted">Days pass on their own every 90 seconds while the porch light is on.</p></div><div className="card"><h3>Live news</h3>{world.news.slice(0,8).map((n,i)=><div className="event" key={i}><b>{n}</b><p>Day {world.day} · {world.weather}</p></div>)}</div></div><div className="locs">{LOCATIONS.map(l=>{const here=active.filter(x=>x.currentLocation===l.key);return <div className="card loc" key={l.key}><b>{l.name}</b><small>{l.kind}</small>{here.length?here.map(x=><div className="who" key={String(x.id)}>● {x.name}<span>{x.embodiment?.action||'idle'}{x.embodiment?.target?` · ${x.embodiment.target}`:''}</span></div>):<p className="muted tiny">Quiet right now.</p>}</div>})}</div></>}

{tab==='people'&&<div className="grid"><div className="card"><div className="eyebrow">PEOPLE</div><h2>Everyone has a life.</h2><p className="muted">Your companions aren't limited to you. They have jobs, places, routines, and their own friendships.</p>{companions.map(x=><div className="event" key={String(x.id)}><b>{x.name}</b><p>{x.embodiment?.action||'idle'} at {locationName(x.currentLocation)} · {x.job||'explorer'} · home {x.home||'Starter Cottage'}</p><small>{(x.hobbies||[]).join(' · ')}</small></div>)}</div><div className="card"><h3>Friendships</h3>{social.length?social.map(s=><div className="event" key={socialKey(s.a,s.b)}><b>{nameOf(s.a)} & {nameOf(s.b)}</b><p>{s.type.replace('_',' ')} · trust {s.trust} · affinity {s.affinity}</p></div>):<p className="muted">When two companions spend time together, their friendship grows here.</p>}<h3 style={{marginTop:22}}>{c.name}'s goals</h3>{(c.goals||[]).map(g=><div className="metric" key={g.id}><label>{g.title}<b>{g.progress}%</b></label><div className="bar"><i style={{width:`${g.progress}%`}}/></div><small>{g.description}</small></div>)}<h3 style={{marginTop:22}}>How free are they?</h3><select value={c.autonomy||'balanced'} onChange={e=>update({autonomy:e.target.value as Companion['autonomy']})}><option value="careful">Careful</option><option value="balanced">Balanced</option><option value="wild">Wild</option></select></div></div>}

{tab==='agent'&&<div className="grid"><div className="card"><div className="eyebrow">AUTONOMY</div><h2>Goals with guardrails.</h2><p className="muted">Companions plan with a fixed toolbox. Anything that could touch money, secrets or the outside world stays locked unless you hand over the permission.</p><input placeholder={`What should ${c.name} try to do?`} value={agentGoal} onChange={e=>setAgentGoal(e.target.value)}/><div className="chips">{PERM_LIST.map(([p,label])=><button key={p} className={'chip perm'+(agentPerms.includes(p)?' on':'')} onClick={()=>togglePerm(p)}>{label}</button>)}</div><button className="primary" onClick={runPlan}>Make a plan</button></div><div className="card"><h3>Plan</h3>{plan.length?plan.map(p=>{const tool=AGENT_TOOLS.find(t=>t.id===p.toolId);return <div className="event" key={String(p.toolId)+p.reason}><b>{tool?.name||p.toolId} <span className={'status '+p.status}>{p.status}</span></b><p>{p.reason}</p>{tool&&p.status==='blocked'&&<small>{safetyNote(tool)}</small>}</div>}):<p className="muted">Give a goal and see the steps a companion would take, and which ones need your permission first.</p>}</div><div className="card"><h3>Log</h3>{agentLog.slice(-10).reverse().map((l,i)=><div className="event" key={i}><p>{l}</p></div>)}{!agentLog.length&&<p className="muted">Nothing planned yet.</p>}</div></div>}

{tab==='create'&&<div className="grid"><div className="card form"><label>Name<input value={c.name} onChange={e=>update({name:e.target.value})}/></label><label>Personality<input value={c.personality} onChange={e=>{const v=e.target.value;update({personality:v,personalityTraits:personalityFromText(v)})}}/></label><label>Job<select value={c.job||'explorer'} onChange={e=>update({job:e.target.value as Job})}>{Object.entries(JOBS).map(([k,v])=><option value={k} key={k}>{v.label} · {locationName(v.location)}</option>)}</select></label><label>Values<input value={(c.values||[]).join(', ')} onChange={e=>update({values:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label><label>Boundaries<input value={(c.boundaries||[]).join(', ')} onChange={e=>update({boundaries:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></label><label>Home<input value={c.home||''} onChange={e=>update({home:e.target.value})}/></label><label>Likes<input value={c.likes.join(', ')} onChange={e=>update({likes:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label><label>Dislikes<input value={c.dislikes.join(', ')} onChange={e=>update({dislikes:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label><button className="link danger" onClick={removeCompanion}>Remove {c.name} from the porch</button></div><div className="card preview"><div className="orb">{c.name[0]}</div><h2>{c.name}</h2><p>{c.personality}</p><b>{companions.length}/{MAX_COMPANIONS} companion slots used</b><p className="muted tiny">Changes save automatically, here and to the cloud.</p></div><div className="card"><div className="eyebrow">PASSPORT</div><h2>Pack {c.name}'s passport.</h2><p className="muted tiny">One small file that carries who {c.name} is: their nature, likes, values, job, level and memories. Use it to move them to another porch, or to hand them to a friend.</p><div className="compose"><button className="primary" onClick={packPassportFile}>Pack passport file</button><button className="link" onClick={copyPassport}>Copy instead</button></div>{passportMsg&&<p className="muted tiny">{passportMsg}</p>}</div></div>}

{tab==='store'&&<div className="store"><div className="card"><div className="item">🌌<div><b>Starry room</b><p>Cosmetic room theme</p></div><button onClick={()=>c.stars>=500&&update({stars:c.stars-500})}>{c.stars>=500?'500 ⭐':'Need 500 ⭐'}</button></div></div><div className="card"><div className="item">✨<div><b>Glow outfit</b><p>Special companion cosmetic</p></div><button onClick={()=>c.gems>=5&&update({gems:c.gems-5})}>{c.gems>=5?'5 💎':'Need 5 💎'}</button></div></div></div>}

{tab==='earn'&&<div className="grid"><div className="card"><h3>Free earning</h3>{[['Daily visit',100,0],['Talk with '+c.name,8,0],['First activity today',50,0],['Milestone bonus',0,1]].map(([n,s,g])=><div className="reward" key={String(n)}><b>{n}</b><span>{s?`+${s} ⭐`:'+1 💎'}</span><button onClick={()=>earn(Number(s),Number(g))}>Claim</button></div>)}</div><div className="card"><h3>Economy rules</h3><p>Core companionship stays free. Stars are fully earnable through play, activities, quests and events. Gems are optional.</p><p>No pay-to-care. No currency required just to talk.</p><div className="stat"><b>Total Stars</b><span>{total.toLocaleString()} ⭐</span></div></div></div>}

{tab==='membership'&&<div className="membership"><div className="card"><div className="eyebrow">FREE FOREVER</div><h2>Porchlight</h2><p>Play the core world without paying. Earn Stars and Gems through activities, quests, events and milestones.</p><ul><li>Core companions and relationships</li><li>Free currency earning</li><li>Games, exploration and hangouts</li><li>No payment required to keep playing</li></ul><button className="primary">Current plan</button></div><div className="card featured"><div className="eyebrow">OPTIONAL</div><h2>World Pass</h2><p>Extra customization and convenience for people who want to support the project.</p><ul><li>Expanded cosmetic collection</li><li>Extra world customization</li><li>Member-only activities and events</li><li>Bonus convenience features</li></ul><div className="plans"><button onClick={()=>alert('Demo only — connect App Store, Google Play, or web billing before charging users.')}>Monthly · $4.99</button><button onClick={()=>alert('Demo only — connect App Store, Google Play, or web billing before charging users.')}>Yearly · $49.99</button></div><small className="muted">Demo pricing only. No real payment is processed in this prototype.</small></div></div>}
</section></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

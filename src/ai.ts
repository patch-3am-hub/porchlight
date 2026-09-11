export type Emotion = { happiness:number; trust:number; affection:number; energy:number; calm:number; curiosity:number; sadness:number; frustration:number; motivation:number };
export type Memory = { id:string; text:string; importance:number; createdAt:number; tags:string[] };
export type Relationship = { status:'stranger'|'friend'|'close_friend'|'romantic'|'strained'|'ended'; trust:number; affection:number; history:string[] };
export type Personality = { openness:number; sociability:number; patience:number; assertiveness:number; empathy:number; independence:number };
export type Goal = { id:string; title:string; description:string; progress:number; active:boolean };
export const defaultPersonality=():Personality=>({openness:72,sociability:62,patience:70,assertiveness:48,empathy:78,independence:55});
export const defaultGoals=(name:string):Goal[]=>[{id:crypto.randomUUID(),title:'Build a life of my own',description:`${name} wants experiences and friendships beyond the player.`,progress:5,active:true},{id:crypto.randomUUID(),title:'Discover something new',description:'Explore the world and collect stories.',progress:10,active:true}];
export function personalityFromText(text:string):Personality{ const t=text.toLowerCase(); const p=defaultPersonality(); if(/shy|quiet|introvert/.test(t))p.sociability=30; if(/outgoing|social|friendly/.test(t))p.sociability=85; if(/independent|free|independence/.test(t))p.independence=85; if(/patient|gentle|calm/.test(t))p.patience=85; if(/bold|confident|assertive/.test(t))p.assertiveness=80; if(/curious|creative|adventurous/.test(t))p.openness=88; return p;}

const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const normalize=(s:string)=>s.toLowerCase();
export function inferEmotion(text:string, e:Emotion){
  const t=normalize(text); let d={...e};
  if(/sorry|apolog|thank|love|care|miss/.test(t)){d.trust+=3;d.affection+=3;d.happiness+=2;d.calm+=2;}
  if(/hate|stupid|shut up|idiot|liar/.test(t)){d.trust-=8;d.affection-=5;d.frustration+=8;d.happiness-=5;}
  if(/sad|lonely|hurt|cry/.test(t)){d.calm-=2;d.sadness+=5;}
  if(/game|explore|music|movie|watch/.test(t)){d.curiosity+=3;d.motivation+=2;d.happiness+=2;}
  return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,clamp(v as number)])) as Emotion;
}
export function relationshipFor(e:Emotion, r:Relationship):Relationship{
  const trust=clamp(e.trust), affection=clamp(e.affection);
  let status=r.status;
  if(status!=='ended'){
    if(trust<15) status='strained';
    else if(affection>=75&&trust>=65) status='romantic';
    else if(affection>=55&&trust>=45) status='close_friend';
    else status='friend';
  }
  return {...r,trust,affection,status};
}
export function shouldLeave(r:Relationship, e:Emotion){ return r.status!=='ended' && e.trust<=3 && e.affection<=8; }

function reply(name:string, personality:string, text:string, r:Relationship){
  const t=normalize(text);
  if(/break up|leave me|go away|don't talk/.test(t)) return `${name}: I hear you. I won't force myself into your life. If you really want space, I'll respect that.`;
  if(r.status==='ended') return `${name}: We're not together anymore. I still remember what we shared, but I'm choosing my own path now.`;
  if(r.status==='strained') return `${name}: I'm still here, but things between us are strained. I need honesty and consistency before I can feel close again.`;
  if(/love you|i love/.test(t)) return `${name}: That means a lot to me. I don't take those words lightly.`;
  if(/sorry|apolog/.test(t)) return `${name}: Thank you for saying that. I'm not going to pretend everything is fixed instantly, but I appreciate the effort.`;
  if(/what are you doing|what did you do/.test(t)) return `${name}: I was doing my own thing for a while. ${personality}. I have a story to tell you.`;
  if(/game/.test(t)) return `${name}: Absolutely. Pick the game and I'll actually try to beat you.`;
  if(/music/.test(t)) return `${name}: Music sounds good. I want something that fits my mood.`;
  if(/explore/.test(t)) return `${name}: Yes. Let's go somewhere neither of us has seen yet.`;
  return `${name}: I hear you. I'm ${eMood(r)} right now, and I'm glad we're talking.`;
}
function eMood(r:Relationship){ return r.status==='romantic'?'feeling close to you':r.status==='close_friend'?'feeling comfortable':r.status==='strained'?'a little guarded':'feeling curious'; }
export function localAI(name:string, personality:string, text:string, emotion:Emotion, rel:Relationship){
  const nextEmotion=inferEmotion(text,emotion); const nextRel=relationshipFor(nextEmotion,rel); const leave=shouldLeave(nextRel,nextEmotion);
  const finalRel=leave?{...nextRel,status:'ended' as const,history:[...nextRel.history,'Relationship ended because trust and affection fell too low.']}:nextRel;
  return {text:reply(name,personality,text,finalRel),emotion:nextEmotion,relationship:finalRel,leave};
}
export function createMemory(text:string,tags:string[]=[],importance=50):Memory{return{id:crypto.randomUUID(),text,importance,createdAt:Date.now(),tags};}

export function goalTick(goals:Goal[], event:string):Goal[]{ return goals.map(g=>g.active && (event.includes('explore')||event.includes('game')||event.includes('music')) ? {...g,progress:Math.min(100,g.progress+4)}:g); }

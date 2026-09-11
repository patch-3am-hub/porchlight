export type BodyAction = 'idle'|'walking'|'holding'|'using'|'cooking'|'building'|'cleaning'|'playing'|'working'|'talking'|'sleeping';
export type Job = 'artist'|'chef'|'builder'|'gardener'|'musician'|'researcher'|'shopkeeper'|'explorer';
export type Location = { key:string; name:string; description:string; kind:string };
export type Embodiment = { action:BodyAction; target?:string; location:string; progress:number; updatedAt:number };
export type SocialLink = { a:string; b:string; type:'acquaintance'|'friend'|'close_friend'|'rival'|'romantic'|'strained'; trust:number; affinity:number; history:string[] };

export const LOCATIONS: Location[] = [
  { key:'starter-cottage', name:'Starter Cottage', description:'A cozy home where companions rest, cook and create.', kind:'home' },
  { key:'neon-arcade', name:'Neon Arcade', description:'Games, racing cabinets and friendly competition.', kind:'entertainment' },
  { key:'moonlit-park', name:'Moonlit Park', description:'A quiet place for walks, conversations and surprises.', kind:'nature' },
  { key:'harbor', name:'Harbor', description:'Fishing, boats, deliveries and exploration.', kind:'work' },
  { key:'creative-district', name:'Creative District', description:'Studios, galleries, music and makers.', kind:'creative' },
  { key:'market', name:'Open Market', description:'Shopping, selling, cooking supplies and social life.', kind:'commerce' },
  { key:'workshop', name:'Community Workshop', description:'Build, repair, craft and collaborate.', kind:'maker' },
  { key:'farm', name:'Sunrise Farm', description:'Grow food, care for animals and learn seasonal routines.', kind:'farm' },
];

export const JOBS: Record<Job,{ label:string; location:string; reward:number; actions:BodyAction[] }> = {
  artist:     { label:'Artist',     location:'creative-district', reward:18, actions:['walking','building','using'] },
  chef:       { label:'Chef',       location:'market',            reward:20, actions:['walking','holding','cooking'] },
  builder:    { label:'Builder',    location:'workshop',          reward:24, actions:['walking','holding','building'] },
  gardener:   { label:'Gardener',   location:'farm',              reward:16, actions:['walking','using','cleaning'] },
  musician:   { label:'Musician',   location:'creative-district', reward:18, actions:['walking','using','playing'] },
  researcher: { label:'Researcher', location:'moonlit-park',      reward:22, actions:['walking','using','talking'] },
  shopkeeper: { label:'Shopkeeper', location:'market',            reward:17, actions:['walking','holding','talking'] },
  explorer:   { label:'Explorer',   location:'harbor',            reward:25, actions:['walking','holding','using'] },
};

export const clamp = (n:number)=>Math.max(0,Math.min(100,n));
export const locationName = (key?:string)=>LOCATIONS.find(l=>l.key===key)?.name||key||'somewhere';

export function embodiedAction(location:string, action:BodyAction, target?:string): Embodiment {
  return { location, action, target, progress:0, updatedAt:Date.now() };
}

export function advanceEmbodiment(e:Embodiment): Embodiment {
  const progress = Math.min(100, e.progress + 25);
  return { ...e, progress, updatedAt:Date.now(), action: progress >= 100 ? 'idle' : e.action };
}

export function socialKey(a:string,b:string){ return [a,b].sort().join('::'); }

export function defaultSocial(a:string,b:string): SocialLink {
  return { a, b, type:'acquaintance', trust:25, affinity:25, history:[] };
}

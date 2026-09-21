export type BodyAction = 'idle'|'walking'|'holding'|'using'|'cooking'|'building'|'cleaning'|'playing'|'working'|'talking'|'sleeping'|'painting'|'sketching'|'planting'|'weeding'|'tuning'|'observing'|'hauling'|'rowing'|'tinkering';
export type Job = 'artist'|'chef'|'builder'|'gardener'|'musician'|'researcher'|'shopkeeper'|'explorer'|'tinkerer';
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

export const JOBS: Record<Job,{ label:string; location:string; reward:number; actions:BodyAction[]; tasks:string[] }> = {
  artist:     { label:'Artist',     location:'creative-district', reward:18, actions:['walking','painting','sketching'], tasks:['painting a mural on the studio wall','sketching the rooftops at dawn','making clay mugs for the market','drawing the regulars at the cafe','carving a small wooden bird','hanging new posters for the market'] },
  chef:       { label:'Chef',       location:'market',            reward:20, actions:['walking','holding','cooking'], tasks:['baking bread before sunrise','cooking stew for the market stalls','trying a new pie recipe','smoking fish for the harbor crew','stacking preserves in the pantry','trading recipes with a traveler'] },
  builder:    { label:'Builder',    location:'workshop',          reward:24, actions:['walking','holding','building'], tasks:['repairing the workshop fence','building market shelves','fixing a porch rail','raising a signpost by the workshop gate','patching the workshop roof','measuring timber for a neighbor'] },
  gardener:   { label:'Gardener',   location:'farm',              reward:16, actions:['walking','planting','weeding'], tasks:['tending the herb rows','planting spring seed','mending the greenhouse glass','weeding the strawberry beds','collecting eggs at first light','bundling herbs for the market'] },
  musician:   { label:'Musician',   location:'creative-district', reward:18, actions:['walking','tuning','playing'], tasks:['tuning the studio piano','writing a song about rain','practicing on the studio steps','playing for the late shift at the cafe','humming while restocking shelves','teaching a kid three chords'] },
  researcher: { label:'Researcher', location:'moonlit-park',      reward:22, actions:['walking','observing','talking'], tasks:['studying tide charts','watching birds at the park','mapping the stars','recording the wind through the trees','sketching the moon path','comparing notes with the park ranger'] },
  shopkeeper: { label:'Shopkeeper', location:'market',            reward:17, actions:['walking','holding','talking'], tasks:['stocking the market stalls','setting out fresh produce','trading stories with a traveler','haggling over a crate of pears','closing up the stall at dusk','labeling jars of honey'] },
  explorer:   { label:'Explorer',   location:'harbor',            reward:25, actions:['walking','hauling','rowing'], tasks:['hauling crates at the harbor','testing a small sailboat','charting a path along the water','climbing the cliffs past the lighthouse','following a rumor to the old pier','rowing out to meet the morning boats'] },
  tinkerer:   { label:'Tinkerer',   location:'neon-arcade',       reward:21, actions:['walking','tinkering','building'], tasks:['rewiring the arcade cabinets','chasing a flicker in the neon sign','building a relay out of spare parts','patching a crack in the arcade wall','soldering a broken lamp','untangling a nest of cables'] },
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

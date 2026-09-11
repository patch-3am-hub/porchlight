export type LifeEvent={id:number;title:string;text:string;kind:'memory'|'spend'|'relationship'|'world';createdAt:number};
export function simulateAway(c:any,lastSeen:number):{companion:any;events:LifeEvent[]}{
  const hours=Math.max(0,Math.floor((Date.now()-lastSeen)/3600000));
  if(hours<6)return {companion:c,events:[]};
  const days=Math.min(14,Math.floor(hours/24));
  let next={...c}; const events:LifeEvent[]=[];
  next.energy=Math.max(35, next.energy-(days*2));
  next.mood=Math.max(25, Math.min(100,next.mood + (days%2===0?1:-2)));
  next.stars=Number(next.stars||0);
  if(days>=1){const spend=Math.min(next.stars,50+Math.floor(Math.random()*451));next.stars-=spend;events.push({id:Date.now(),title:`${next.name} did something while you were away`,text:`${next.name} spent ${spend} Stars at a place that caught their attention.`,kind:'spend',createdAt:Date.now()});}
  if(days>=3){events.push({id:Date.now()+1,title:`A new memory`,text:`${next.name} had a small adventure and came back with something to tell you.`,kind:'memory',createdAt:Date.now()});next.affection=Math.max(0,Math.min(100,next.affection-1));}
  return {companion:next,events};
}

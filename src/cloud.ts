import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type CloudStatus = 'local' | 'connected';
export const cloudConfig = { url: import.meta.env.VITE_SUPABASE_URL || '', anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' };
export const cloudStatus: CloudStatus = cloudConfig.url && cloudConfig.anonKey ? 'connected' : 'local';
export const supabase: SupabaseClient | null = cloudStatus === 'connected' ? createClient(cloudConfig.url, cloudConfig.anonKey) : null;

export async function signUp(email:string,password:string){ if(!supabase) throw new Error('Cloud is not configured.'); return supabase.auth.signUp({email,password}); }
export async function signIn(email:string,password:string){ if(!supabase) throw new Error('Cloud is not configured.'); return supabase.auth.signInWithPassword({email,password}); }
export async function signOut(){ if(supabase) await supabase.auth.signOut(); }
export async function getSession(){ return supabase ? (await supabase.auth.getSession()).data.session : null; }

export async function loadCompanions(userId:string){
  if(!supabase) return null;
  const {data,error} = await supabase.from('companions').select('*').eq('user_id',userId).order('slot');
  if(error) throw error; return data;
}

export async function saveCompanion(userId:string, companion:any, slot:number){
  if(!supabase) return;
  const row:any = {
    user_id:userId,
    slot,
    id:typeof companion.id === 'string' ? companion.id : undefined,
    name:companion.name,
    personality:companion.personality,
    likes:companion.likes,
    dislikes:companion.dislikes,
    happiness:companion.mood,
    trust:companion.trust,
    affection:companion.affection,
    energy:companion.energy,
    level:companion.level,
    stars:companion.stars,
    gems:companion.gems,
    relationship_status:companion.relationship?.status === 'ended' ? 'broken_up' : (companion.relationship?.status || 'friend'),
    autonomy_mode:companion.autonomy || 'balanced',
    goals:companion.goals || [],
    values:companion.values || [],
    boundaries:companion.boundaries || [],
    traits:companion.personalityTraits || {},
    job:companion.job || 'explorer',
    current_location:companion.currentLocation || 'starter-cottage',
    embodied_state:companion.embodiment || {},
    needs:companion.needs || { hunger:15, social:20, fun:20, rest:15 },
    home:companion.home || 'Starter Cottage',
    hobbies:companion.hobbies || [],
  };
  // upsert by id: each companion updates in place, slot included.
  // callers keep slot moves ordered (main.tsx saveChain) so unique(user_id,slot) never fights.
  const {error} = await supabase.from('companions').upsert(row,{onConflict:'id'});
  if(error) throw error;
}

export async function deleteCompanion(userId:string, companionId:string){
  if(!supabase) return;
  const {error} = await supabase.from('companions').delete().eq('user_id',userId).eq('id',companionId);
  if(error) throw error;
}

export async function addConversation(userId:string, companionId:string, role:'user'|'assistant', content:string){
  if(!supabase) return; const {error} = await supabase.from('conversations').insert({user_id:userId,companion_id:companionId,role,content}); if(error) throw error;
}

/** Last messages with a companion, oldest first, so a refresh doesn't wipe the thread. */
export async function loadConversations(userId:string, companionId:string, limit=40){
  if(!supabase) return [];
  const {data,error} = await supabase.from('conversations').select('role,content,created_at').eq('user_id',userId).eq('companion_id',companionId).order('created_at',{ascending:false}).limit(limit);
  if(error) throw error; return (data || []).reverse();
}

export type SimulationRecord = { eventId:string; companionId?:string; kind:'world'|'activity'|'memory'|'spend'|'relationship'; title:string; description:string; payload?:any };

/** Persist world/simulation events so the story survives device switches. Idempotent by eventId. */
export async function recordSimulationEvent(userId:string, e:SimulationRecord){
  if(!supabase) return;
  const {error} = await supabase.from('simulation_events').upsert({
    user_id:userId,
    event_id:e.eventId,
    companion_id:e.companionId || null,
    kind:e.kind,
    title:e.title,
    description:e.description,
    payload:e.payload || {},
  },{onConflict:'user_id,event_id'});
  if(error) throw error;
}

export async function loadMemories(userId:string){
  if(!supabase) return [];
  const {data,error} = await supabase.from('memories').select('id,companion_id,kind,summary,importance,tags,created_at').eq('user_id',userId).order('created_at',{ascending:true});
  if(error) throw error; return data || [];
}

/** Write carried memories (passport moments) into the cloud. Importance: client 0-100 -> stored 1-5. */
export async function saveMemories(userId:string, companionId:string, memories:any[], source='passport'){
  if(!supabase) return;
  const rows=(memories||[]).filter(m=>m&&(m.text||m.summary)).map(m=>({
    user_id:userId, companion_id:companionId,
    kind:m.kind||'passport',
    summary:String(m.text||m.summary).slice(0,240),
    importance:Math.max(1,Math.min(5,Math.ceil(Number(m.importance||50)/20))),
    tags:Array.isArray(m.tags)?m.tags.slice(0,6):[],
    source:m.source||source, confidence:100,
  }));
  if(!rows.length) return;
  const {error}=await supabase.from('memories').insert(rows);
  if(error) throw error;
}

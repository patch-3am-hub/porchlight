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
  const {data,error}=await supabase.from('companions').select('*').eq('user_id',userId).order('slot');
  if(error) throw error; return data;
}
export async function saveCompanion(userId:string, companion:any, slot:number){
  if(!supabase) return;
  const row:any={user_id:userId,slot,id:typeof companion.id==='string' ? companion.id : undefined,name:companion.name,personality:companion.personality,likes:companion.likes,dislikes:companion.dislikes,happiness:companion.mood,trust:companion.trust,affection:companion.affection,energy:companion.energy,level:companion.level,stars:companion.stars,gems:companion.gems,relationship_status:companion.relationship?.status==='ended'?'broken_up':(companion.relationship?.status||'friend'),autonomy_mode:companion.autonomy||'balanced',goals:companion.goals||[],values:companion.values||[],traits:companion.personalityTraits||{}};
  const {error}=await supabase.from('companions').upsert(row,{onConflict:'user_id,slot'});
  if(error) throw error;
}
export async function addConversation(userId:string, companionId:string, role:'user'|'assistant', content:string){
  if(!supabase) return; const {error}=await supabase.from('conversations').insert({user_id:userId,companion_id:companionId,role,content}); if(error) throw error;
}

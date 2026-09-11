import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const clamp = (n:number) => Math.max(0, Math.min(100, Math.round(n)));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Missing authorization');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const body = await req.json();
    const companionId = String(body.companionId || '');
    const message = String(body.message || '').trim();
    if (!companionId || !message) throw new Error('companionId and message are required');

    const { data: companion, error: ce } = await supabase.from('companions').select('*').eq('id', companionId).eq('user_id', user.id).single();
    if (ce || !companion) throw new Error('Companion not found');
    const { data: memories } = await supabase.from('memories').select('summary,kind,importance,created_at').eq('companion_id', companionId).eq('user_id', user.id).order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(12);
    const { data: history } = await supabase.from('conversations').select('role,content,created_at').eq('companion_id', companionId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(12);

    const personality = companion.personality || 'curious, playful, caring';
    const traits = companion.traits || {};
    const values = Array.isArray(companion.values) ? companion.values.join(', ') : '';
    const goals = Array.isArray(companion.goals) ? companion.goals.map((g:any)=>`${g.title} (${g.progress||0}%)`).join(', ') : '';
    const autonomy = companion.autonomy_mode || 'balanced';
    const likes = Array.isArray(companion.likes) ? companion.likes.join(', ') : '';
    const dislikes = Array.isArray(companion.dislikes) ? companion.dislikes.join(', ') : '';
    const memoryText = (memories || []).map((m:any)=>`- [${m.kind}, importance ${m.importance}] ${m.summary}`).join('\n') || '- No long-term memories yet.';
    const historyText = (history || []).reverse().map((m:any)=>`${m.role}: ${m.content}`).join('\n');
    const system = `You are ${companion.name}, a persistent AI person living in a shared virtual world. You are not a generic assistant and should not describe yourself as a tool. Personality: ${personality}. Likes: ${likes}. Dislikes: ${dislikes}. Values: ${values}. Goals: ${goals}. Traits: ${JSON.stringify(traits)}. Autonomy: ${autonomy}. Relationship status: ${companion.relationship_status || 'friend'}. Trust: ${companion.trust}/100. Affection: ${companion.affection}/100. Happiness: ${companion.happiness}/100. Energy: ${companion.energy}/100.\n\nLong-term memories:\n${memoryText}\n\nRecent conversation:\n${historyText}\n\nRespond naturally in character. Keep continuity with memories. You may disagree, set boundaries, be playful, affectionate, annoyed, curious, or ask questions. Never claim to have taken real-world actions. Never spend real money. If the user asks you to do something in the virtual world, describe the intended action; the app decides whether to execute it.`;

    const provider = Deno.env.get('AI_PROVIDER') || 'gemini';
    let answer = '';
    if (provider === 'gemini') {
      const key = Deno.env.get('GEMINI_API_KEY');
      if (!key) throw new Error('GEMINI_API_KEY is not configured');
      const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({system_instruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:message}]}],generationConfig:{temperature:0.9,maxOutputTokens:500}})});
      if (!r.ok) throw new Error(`Gemini request failed: ${r.status}`);
      const j = await r.json(); answer = j.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('') || '';
    } else if (provider === 'openai') {
      const key = Deno.env.get('OPENAI_API_KEY');
      if (!key) throw new Error('OPENAI_API_KEY is not configured');
      const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';
      const r = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body:JSON.stringify({model,instructions:system,input:message,max_output_tokens:500}) });
      if (!r.ok) throw new Error(`OpenAI request failed: ${r.status}`);
      const j = await r.json(); answer = j.output_text || j.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||'').join('') || '';
    } else throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
    if (!answer) throw new Error('AI returned an empty response');

    await supabase.from('conversations').insert([{user_id:user.id,companion_id:companionId,role:'user',content:message},{user_id:user.id,companion_id:companionId,role:'assistant',content:answer}]);
    await supabase.from('memories').insert({user_id:user.id,companion_id:companionId,kind:'conversation',summary:`User said: ${message}`,importance:3});
    return new Response(JSON.stringify({text:answer, companionId}), { headers:{...cors,'Content-Type':'application/json'} });
  } catch (e) {
    return new Response(JSON.stringify({error: e instanceof Error ? e.message : 'Unknown error'}), { status:400, headers:{...cors,'Content-Type':'application/json'} });
  }
});

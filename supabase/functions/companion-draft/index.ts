import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const JOBS = ['artist','chef','builder','gardener','musician','researcher','shopkeeper','explorer'];

// light in-instance speed bump; not a hard quota
const buckets = new Map<string, { n: number; t: number }>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Missing authorization');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const bucket = buckets.get(user.id) || { n: 0, t: Date.now() };
    if (Date.now() - bucket.t > 3600000) { bucket.n = 0; bucket.t = Date.now(); }
    bucket.n += 1; buckets.set(user.id, bucket);
    if (bucket.n > 12) throw new Error('Too many drafts for now. Try again in a little while.');

    const body = await req.json().catch(() => ({}));
    const ask = String(body.message || '').trim() || 'Surprise me with someone unexpected but lovable.';

    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY is not configured');
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash';
    const system = `You design ONE companion for Porchlight, a cozy virtual world where each companion lives their own days: a job, places, needs, friendships. Given a short request from a new user, invent a distinctive, specific person (not a generic helper). Reply ONLY with valid JSON shaped like:
{"name":"...","personality":"3-8 comma-separated traits","likes":["...","..."],"dislikes":["...","..."],"job":"artist|chef|builder|gardener|musician|researcher|shopkeeper|explorer"}
Choose the job that fits them. Keep every string short; no sentences in fields. Names: one word or a cozy two-word name.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: ask }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              personality: { type: 'string' },
              likes: { type: 'array', items: { type: 'string' } },
              dislikes: { type: 'array', items: { type: 'string' } },
              job: { type: 'string', enum: JOBS },
            },
            required: ['name', 'personality', 'likes', 'dislikes', 'job'],
          },
        },
      }),
    });
    if (!r.ok) {
      if (r.status === 503 || r.status === 429) throw new Error('The porch helper is busy right now. Try again in a minute.');
      throw new Error(`Helper request failed: ${r.status}`);
    }
    const j = await r.json();
    let text = j.candidates?.[0]?.content?.parts?.filter((p:any)=>!p.thought).map((p:any)=>p.text||'').join('') || '';
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let draft:any = null;
    try { draft = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { draft = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!draft || typeof draft !== 'object') throw new Error('The helper misdrew that one. Try again.');
    const clean = {
      name: String(draft.name || 'Newcomer').slice(0, 40),
      personality: String(draft.personality || 'curious, warm').slice(0, 160),
      likes: (Array.isArray(draft.likes) ? draft.likes : []).map((x:any)=>String(x).slice(0, 40)).slice(0, 6),
      dislikes: (Array.isArray(draft.dislikes) ? draft.dislikes : []).map((x:any)=>String(x).slice(0, 40)).slice(0, 6),
      job: JOBS.includes(String(draft.job)) ? String(draft.job) : 'explorer',
    };
    return new Response(JSON.stringify({ draft: clean }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

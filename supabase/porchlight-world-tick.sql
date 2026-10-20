-- Porchlight server-side world tick (live definitions, dumped from the cloud DB 2026-10-20).
-- porchlight_tick(user, days): advance one world day per call, idempotent per (user, event_id).
-- porchlight_advance_all(): tick every user who has companions; this is what the pg_cron job
--   'porchlight-world-tick' (every 15 min) calls, so days pass even when no one has the app open.
-- FNV-1a sim_event_id is byte-identical to the client's, so both sides upsert the same rows.

CREATE OR REPLACE FUNCTION public.porchlight_advance_all()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_days int;
begin
  for r in
    select ws.user_id, ws.last_tick from world_state ws
    where exists (select 1 from companions c where c.user_id = ws.user_id and c.relationship_status <> 'broken_up')
  loop
    v_days := least(14, greatest(0, floor(extract(epoch from (now() - r.last_tick)) / 3600)::int));
    if v_days > 0 then
      perform porchlight_tick(r.user_id, v_days);
    end if;
  end loop;
end $function$

CREATE OR REPLACE FUNCTION public.porchlight_tick(p_user uuid, p_days integer DEFAULT 1)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_weather_arr text[] := array['Clear skies','Light rain','Warm breeze','Starry night','Cloudy'];
  v_loc_keys text[] := array['starter-cottage','neon-arcade','moonlit-park','harbor','creative-district','market','workshop','farm'];
  v_loc_names jsonb := '{"starter-cottage":"Starter Cottage","neon-arcade":"Neon Arcade","moonlit-park":"Moonlit Park","harbor":"Harbor","creative-district":"Creative District","market":"Open Market","workshop":"Community Workshop","farm":"Sunrise Farm"}'::jsonb;
  v_jobs jsonb := '{
    "artist":{"location":"creative-district","reward":18,"actions":["walking","painting","sketching"],"tasks":["painting a mural on the studio wall","sketching the rooftops at dawn","making clay mugs for the market","drawing the regulars at the cafe","carving a small wooden bird","hanging new posters for the market"]},
    "chef":{"location":"market","reward":20,"actions":["walking","holding","cooking"],"tasks":["baking bread before sunrise","cooking stew for the market stalls","trying a new pie recipe","smoking fish for the harbor crew","stacking preserves in the pantry","trading recipes with a traveler"]},
    "builder":{"location":"workshop","reward":24,"actions":["walking","holding","building"],"tasks":["repairing the workshop fence","building market shelves","fixing a porch rail","raising a signpost by the workshop gate","patching the workshop roof","measuring timber for a neighbor"]},
    "gardener":{"location":"farm","reward":16,"actions":["walking","planting","weeding"],"tasks":["tending the herb rows","planting spring seed","mending the greenhouse glass","weeding the strawberry beds","collecting eggs at first light","bundling herbs for the market"]},
    "musician":{"location":"creative-district","reward":18,"actions":["walking","tuning","playing"],"tasks":["tuning the studio piano","writing a song about rain","practicing on the studio steps","playing for the late shift at the cafe","humming while restocking shelves","teaching a kid three chords"]},
    "researcher":{"location":"moonlit-park","reward":22,"actions":["walking","observing","talking"],"tasks":["studying tide charts","watching birds at the park","mapping the stars","recording the wind through the trees","sketching the moon path","comparing notes with the park ranger"]},
    "shopkeeper":{"location":"market","reward":17,"actions":["walking","holding","talking"],"tasks":["stocking the market stalls","setting out fresh produce","trading stories with a traveler","haggling over a crate of pears","closing up the stall at dusk","labeling jars of honey"]},
    "explorer":{"location":"harbor","reward":25,"actions":["walking","hauling","rowing"],"tasks":["hauling crates at the harbor","testing a small sailboat","charting a path along the water","climbing the cliffs past the lighthouse","following a rumor to the old pier","rowing out to meet the morning boats"]},
    "tinkerer":{"location":"neon-arcade","reward":21,"actions":["walking","tinkering","building"],"tasks":["rewiring the arcade cabinets","chasing a flicker in the neon sign","building a relay out of spare parts","patching a crack in the arcade wall","soldering a broken lamp","untangling a nest of cables"]}
  }'::jsonb;
  v_day int; v_weather text; v_clock int; v_news jsonb;
  v_iter int; i int; rec record; v_job jsonb; v_loc text; v_reward int;
  v_action text; v_task text; v_errand bool; v_from text; v_needs jsonb;
  v_energy int; v_stars bigint;
  v_active_len int; v_off int; v_headline text;
  v_actor_id uuid; v_actor_name text; v_actor_action text; v_actor_loc text;
  v_a_id uuid; v_a_name text; v_a_loc text; v_b_id uuid; v_b_name text; v_b_loc text;
  v_key text; v_drift int; v_trust int; v_affinity int; v_type text; v_text text;
  v_pairs int; v_idx int; v_k int; v_p int; v_q int;
begin
  insert into world_state(user_id) values (p_user) on conflict (user_id) do nothing;
  select day, weather, clock, news into v_day, v_weather, v_clock, v_news from world_state where user_id = p_user;

  for v_iter in 1..greatest(1, p_days) loop
    v_day := v_day + 1;
    v_weather := v_weather_arr[(abs(v_day*11) % 5) + 1];
    i := 0;
    for rec in select * from companions where user_id = p_user and relationship_status <> 'broken_up' order by slot loop
      v_job := coalesce(v_jobs -> coalesce(rec.job,'explorer'), v_jobs -> 'explorer');
      v_loc := v_job->>'location';
      v_reward := (v_job->>'reward')::int;
      v_action := (v_job->'actions')->>((v_day + i) % 3);
      v_task := (v_job->'tasks')->>((v_day + i) % 6);
      v_errand := ((v_day + i) % 4 = 0);
      v_from := null;
      if v_errand then
        v_from := (array_remove(v_loc_keys, v_loc))[(abs(v_day*7 + i) % 7) + 1];
      end if;
      v_needs := jsonb_build_object(
        'hunger', least(100, coalesce((rec.needs->>'hunger')::int, 10) + 8),
        'social', least(100, coalesce((rec.needs->>'social')::int, 15) + 6),
        'fun',    least(100, coalesce((rec.needs->>'fun')::int, 15) + 5),
        'rest',   least(100, coalesce((rec.needs->>'rest')::int, 15) + 7)
      );
      v_energy := least(100, greatest(0, rec.energy + 9));
      v_stars := rec.stars + v_reward + (case when rec.autonomy_mode = 'wild' then 8 else 0 end);
      update companions set
        current_location = v_loc,
        embodied_state = jsonb_build_object(
          'action', case when v_errand then 'walking' else v_action end,
          'target', case when v_errand then ('the long way home past '||(v_loc_names->>v_from)) else v_task end,
          'location', v_loc, 'progress', 0,
          'updatedAt', (extract(epoch from now())*1000)::bigint),
        energy = v_energy,
        stars = v_stars,
        needs = v_needs
      where id = rec.id;
      insert into simulation_events(user_id, companion_id, event_id, kind, title, description, payload, created_at)
      values (p_user, rec.id, 'd'||v_day||'-'||rec.id, 'activity', 'Day '||v_day||' · '||rec.name,
        case when v_errand then rec.name||' took the long way to '||(v_loc_names->>v_loc)||', past '||(v_loc_names->>v_from)||'.'
             else rec.name||' spent the day '||v_task||' at '||(v_loc_names->>v_loc)||'.' end,
        jsonb_build_object('day', v_day, 'job', coalesce(rec.job,'explorer')), now())
      on conflict (user_id, event_id) do nothing;
      i := i + 1;
    end loop;

    select count(*) into v_active_len from companions where user_id = p_user and relationship_status <> 'broken_up';
    if v_active_len = 0 then
      v_headline := 'The world changed while everyone was away.';
      insert into simulation_events(user_id, companion_id, event_id, kind, title, description, payload, created_at)
      values (p_user, null, sim_event_id('porchlight-world', v_day, 'world', 'world'), 'world', 'Day '||v_day, v_headline,
              jsonb_build_object('day', v_day, 'weather', v_weather), now())
      on conflict (user_id, event_id) do nothing;
    else
      v_off := v_day % v_active_len;
      select id, name, coalesce(embodied_state->>'action','idle'), current_location
        into v_actor_id, v_actor_name, v_actor_action, v_actor_loc
        from companions where user_id = p_user and relationship_status <> 'broken_up' order by slot offset v_off limit 1;
      v_headline := v_actor_name||' is '||v_actor_action||' at '||(v_loc_names->>v_actor_loc)||'.';
      insert into simulation_events(user_id, companion_id, event_id, kind, title, description, payload, created_at)
      values (p_user, v_actor_id, sim_event_id('porchlight-world', v_day, 'world', v_actor_id::text), 'world', 'Day '||v_day, v_headline,
              jsonb_build_object('day', v_day, 'weather', v_weather), now())
      on conflict (user_id, event_id) do nothing;

      if v_active_len >= 2 then
        v_pairs := v_active_len*(v_active_len-1)/2;
        v_idx := v_day % v_pairs;
        v_k := 0;
        for p in 0..v_active_len-2 loop
          for q in p+1..v_active_len-1 loop
            if v_k = v_idx then v_p := p; v_q := q; end if;
            v_k := v_k + 1;
          end loop;
        end loop;
        select id, name, current_location into v_a_id, v_a_name, v_a_loc
          from companions where user_id = p_user and relationship_status <> 'broken_up' order by slot offset v_p limit 1;
        select id, name, current_location into v_b_id, v_b_name, v_b_loc
          from companions where user_id = p_user and relationship_status <> 'broken_up' order by slot offset v_q limit 1;
        v_key := least(v_a_id::text, v_b_id::text)||'::'||greatest(v_a_id::text, v_b_id::text);
        v_trust := 25; v_affinity := 25; v_type := 'acquaintance';
        select trust, affinity, relationship_type into v_trust, v_affinity, v_type
          from companion_relationships
          where user_id = p_user
            and companion_a = least(v_a_id, v_b_id) and companion_b = greatest(v_a_id, v_b_id);
        if not found then v_trust := 25; v_affinity := 25; v_type := 'acquaintance'; end if;
        v_drift := ((v_day*7) % 3) - 1;
        v_trust := least(100, greatest(0, v_trust + 4));
        v_affinity := least(100, greatest(0, v_affinity + 3 + v_drift));
        if v_trust >= 70 and v_affinity >= 70 then v_type := 'close_friend';
        elsif v_trust >= 45 and v_affinity >= 45 then v_type := 'friend';
        elsif v_trust < 12 then v_type := 'strained';
        end if;
        v_text := v_a_name||' and '||v_b_name||' spent time together at '||(v_loc_names->>v_a_loc)||'. Trust '||v_trust||', affinity '||v_affinity||' ('||replace(v_type,'_',' ')||').';
        insert into companion_relationships(user_id, companion_a, companion_b, relationship_type, trust, affinity, history)
        values (p_user, least(v_a_id, v_b_id), greatest(v_a_id, v_b_id), v_type, v_trust, v_affinity,
                jsonb_build_array(v_a_name||' and '||v_b_name||' crossed paths on day '||v_day||'.'))
        on conflict (companion_a, companion_b) do update set
          relationship_type = excluded.relationship_type,
          trust = excluded.trust,
          affinity = excluded.affinity,
          history = jsonb_tail6(companion_relationships.history || excluded.history);
        insert into simulation_events(user_id, companion_id, event_id, kind, title, description, payload, created_at)
        values (p_user, v_a_id, sim_event_id('porchlight-social', v_day, 'relationship', v_key), 'relationship',
                v_a_name||' & '||v_b_name, v_text,
                jsonb_build_object('trust', v_trust, 'affinity', v_affinity, 'type', v_type), now())
        on conflict (user_id, event_id) do nothing;
      end if;
    end if;

    v_clock := (v_clock + 90) % 1440;
    v_news := jsonb_build_array(v_headline) || (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select x from jsonb_array_elements(v_news) x limit 11
      ) s);
    update world_state set day = v_day, weather = v_weather, clock = v_clock, news = v_news, last_tick = now() where user_id = p_user;
  end loop;
  return v_day;
end $function$


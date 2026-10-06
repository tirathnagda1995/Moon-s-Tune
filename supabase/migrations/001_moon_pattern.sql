-- Moon Pattern V1. Run once on a fresh Supabase project.
begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 person_id uuid not null unique default gen_random_uuid(),
 locale text not null default 'en', timezone text not null default 'UTC',
 region text not null default 'unspecified', units text not null default 'metric',
 created_at timestamptz not null default now()
);
create table public.daily_observations (
 id uuid primary key, person_id uuid not null references public.profiles(person_id) on delete cascade,
 local_date date not null, timezone text not null, created_at timestamptz not null,
 revision integer not null check(revision>0), schema_version integer not null default 1,
 data jsonb not null check(not (data ? 'journal')),
 unique(person_id,local_date), unique(id,person_id)
);
create index observations_person_time on public.daily_observations(person_id,local_date desc);
create table public.observation_revisions (
 observation_id uuid not null references public.daily_observations(id) on delete cascade,
 revision integer not null, data jsonb not null check(not(data ? 'journal')),
 created_at timestamptz not null default now(), primary key(observation_id,revision)
);
create table public.private_journals (
 observation_id uuid primary key references public.daily_observations(id) on delete cascade,
 ciphertext jsonb not null check(ciphertext->>'version'='1' and ciphertext ?& array['iv','salt','data']),
 retention_class text not null default 'until-user-deletion', processing_purpose text not null default 'PRIVATE_VAULT',
 updated_at timestamptz not null default now()
);
create table public.derived_signals (
 id uuid primary key, observation_id uuid not null references public.daily_observations(id) on delete cascade,
 dimension text not null, value numeric not null check(value between 1 and 5), confidence numeric not null check(confidence between 0 and 1),
 source_type text not null check(source_type in ('SELF_REPORTED','DEVICE_MEASURED','USER_CORRECTED','ENVIRONMENTAL','ASTRONOMICAL','EXTERNALLY_OBSERVED','MODEL_INFERRED','DERIVED_STATISTICAL')),
 unit text not null, effective_local_date date not null, timezone text not null,
 measured_at timestamptz not null, window_start timestamptz, window_end timestamptz,
 temporal_resolution text not null default 'daily', provenance jsonb not null,
 schema_version integer not null default 1, created_at timestamptz not null default now()
);
create index signals_observation_dimension on public.derived_signals(observation_id,dimension);
create table public.user_corrections (
 id uuid primary key references public.derived_signals(id) on delete cascade,
 observation_id uuid not null references public.daily_observations(id) on delete cascade,
 supersedes uuid, created_at timestamptz not null default now()
);
create table public.lunar_context (
 observation_id uuid primary key references public.daily_observations(id) on delete cascade,
 phase integer not null check(phase between 0 and 7), illumination double precision not null check(illumination between 0 and 1),
 lunar_age double precision not null, cycle integer not null, ephemeris_version text not null, data jsonb not null
);
create table public.environment_context (
 observation_id uuid primary key references public.daily_observations(id) on delete cascade,
 coarse_place_id text, provider text, measured_at timestamptz,
 temperature numeric, feels_like numeric, humidity numeric, pressure numeric, pressure_change numeric,
 rain numeric,snow numeric,cloud_cover numeric,sunrise timestamptz,sunset timestamptz,daylight_minutes numeric,
 wind numeric,uv numeric,air_quality numeric,season text,condition text,extreme_weather boolean,
 consent_id uuid, schema_version integer not null default 1
);
create table public.pattern_results (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.profiles(person_id) on delete cascade,
 calculated_at timestamptz not null default now(), engine_version text not null, candidate text not null,
 dimension text not null, effect_magnitude numeric, sample_size integer not null, independent_periods integer not null,
 completeness numeric, uncertainty jsonb, confounders jsonb, replication_status text not null default 'not-tested',data jsonb not null
);
create index patterns_person_time on public.pattern_results(person_id,calculated_at desc);
create table public.consents (
 id uuid primary key, person_id uuid not null references public.profiles(person_id) on delete cascade,
 purpose text not null check(purpose in ('CORE_APP','OPTIONAL_AI_TEXT_PROCESSING','WEARABLE_HEALTH_ANALYSIS','LOCATION_CONTEXT','ENVIRONMENT_CONTEXT','RESEARCH','AGGREGATED_RESEARCH','MARKETING')),
 granted boolean not null, timestamp timestamptz not null default now(), version text not null, region text not null,
 retention_class text not null default 'account-lifetime'
);
create index consents_person_purpose_time on public.consents(person_id,purpose,timestamp desc);
create table public.ai_usage (
 person_id uuid not null references public.profiles(person_id) on delete cascade,
 day date not null, requests integer not null default 0, primary key(person_id,day)
);
-- Future systems are schema-only; no wearable/location/research ingestion is enabled.
create table public.event_context (
 id uuid primary key default gen_random_uuid(), headline text not null, category text not null,
 coarse_place_ids text[], starts_at timestamptz not null, ends_at timestamptz, valence text,
 severity numeric, prominence numeric, affected_population bigint, source text not null, confidence numeric,
 schema_version integer not null default 1
);
create table public.health_measurements (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references public.profiles(person_id) on delete cascade,
 provider text not null, device text, original_type text not null, original_unit text not null,
 canonical_metric text not null, canonical_unit text not null, value numeric not null,
 measured_at timestamptz not null, window_start timestamptz, window_end timestamptz, resolution text not null,
 quality_metadata jsonb, consent_id uuid not null, schema_version integer not null default 1
);
create index health_person_time on public.health_measurements(person_id,measured_at desc);
create table public.plans (id text primary key, capabilities jsonb not null default '{}',active boolean not null default false);
create table public.entitlements (person_id uuid not null references public.profiles(person_id) on delete cascade,plan_id text not null references public.plans(id),expires_at timestamptz,primary key(person_id,plan_id));
insert into public.plans(id,capabilities,active) values('free','{"checkin":true,"memories":true,"patterns":true}',true),('plus','{}',false),('pro','{}',false);

create function public.my_person_id() returns uuid language sql stable security definer set search_path=public,pg_temp as $$select person_id from public.profiles where user_id=(select auth.uid())$$;
revoke all on function public.my_person_id() from public;
grant execute on function public.my_person_id() to authenticated;
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(user_id=(select auth.uid()));
-- Writes happen through tightly scoped RPCs; table writes are not granted to clients.
do $$ declare tab text; begin
 foreach tab in array array['daily_observations','pattern_results','consents','ai_usage','health_measurements','entitlements'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('create policy own_read on public.%I for select to authenticated using(person_id=(select public.my_person_id()))',tab);
 end loop;
 foreach tab in array array['observation_revisions','private_journals','derived_signals','user_corrections','lunar_context','environment_context'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('create policy own_read on public.%I for select to authenticated using(exists(select 1 from public.daily_observations o where o.id=observation_id and o.person_id=(select public.my_person_id())))',tab);
 end loop;
end $$;
alter table public.event_context enable row level security;
alter table public.plans enable row level security;
create policy active_plans on public.plans for select to authenticated using(active);
create policy own_delete on public.daily_observations for delete to authenticated using(person_id=(select public.my_person_id()));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.daily_observations,public.observation_revisions,public.private_journals,public.derived_signals,public.user_corrections,public.lunar_context,public.environment_context,public.pattern_results,public.consents,public.health_measurements,public.entitlements,public.plans to authenticated;
grant delete on public.daily_observations to authenticated;

create function public.record_consent(record jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Unauthorized';end if;
 if octet_length(record::text)>2000 then raise exception 'Too large';end if;
 insert into public.profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select person_id into pid from public.profiles where user_id=auth.uid();
 insert into public.consents(id,person_id,purpose,granted,version,region) values((record->>'id')::uuid,pid,record->>'purpose',(record->>'granted')::boolean,'1',left(coalesce(record->>'region','unspecified'),50));
end $$;

create function public.save_observation(entry jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid; oid uuid; existing public.daily_observations; clean jsonb; s jsonb; phase jsonb; rev integer;
begin
 if auth.uid() is null then raise exception 'Unauthorized';end if;
 if octet_length(entry::text)>150000 or entry->>'schemaVersion'<>'1' or jsonb_typeof(entry->'signals')<>'array' or jsonb_array_length(entry->'signals')>200 then raise exception 'Invalid observation';end if;
 insert into public.profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select person_id into pid from public.profiles where user_id=auth.uid();
 oid:=(entry->>'id')::uuid;rev:=(entry->>'revision')::integer;
 -- Serialize this person's saves, including insert races on a new day.
 perform 1 from public.profiles where person_id=pid for update;
 select * into existing from public.daily_observations where id=oid;
 if existing.id is not null and existing.person_id<>pid then raise exception 'Unauthorized';end if;
 if existing.id is not null and rev<>existing.revision+1 then raise exception 'Revision conflict';end if;
 if existing.id is null and rev<>1 then raise exception 'Invalid initial revision';end if;
 if existing.id is not null and ((entry->>'localDate')::date<>existing.local_date or entry->>'timezone'<>existing.timezone) then raise exception 'Immutable observation time';end if;
 if (entry->>'localDate')::date>current_date+1 or length(entry->>'timezone')>80 then raise exception 'Invalid date';end if;
 clean:=jsonb_build_object('id',oid,'personId',pid,'createdAt',coalesce(existing.created_at,(entry->>'createdAt')::timestamptz),'localDate',entry->>'localDate','timezone',entry->>'timezone','schemaVersion',1,'revision',rev,'signals',entry->'signals','lunar',entry->'lunar','language',left(entry->>'language',35),'reflectionCode',entry->>'reflectionCode','feedback',entry->>'feedback');
 if clean->>'reflectionCode' not in ('recorded','positive','low','urgent') then raise exception 'Invalid reflection';end if;
 insert into public.daily_observations(id,person_id,local_date,timezone,created_at,revision,data) values(oid,pid,(entry->>'localDate')::date,entry->>'timezone',(entry->>'createdAt')::timestamptz,rev,clean)
 on conflict(id) do update set revision=rev,data=clean;
 insert into public.observation_revisions(observation_id,revision,data) values(oid,rev,clean);
 for s in select * from jsonb_array_elements(entry->'signals') loop
 if s->>'dimension' not in ('emotional_valence','energy_arousal','stress_tension','restfulness','focus','physical_vitality','emotional_intensity','calmness','cognitive_clarity','social_connectedness','motivation') then raise exception 'Invalid dimension';end if;
 if exists(select 1 from public.derived_signals where id=(s->>'id')::uuid and (observation_id<>oid or provenance<>s)) then raise exception 'Immutable signal';end if;
 insert into public.derived_signals(id,observation_id,dimension,value,confidence,source_type,unit,effective_local_date,timezone,measured_at,provenance)
 values((s->>'id')::uuid,oid,s->>'dimension',(s->>'value')::numeric,(s->>'confidence')::numeric,s->>'sourceType',s->>'unit',(entry->>'localDate')::date,entry->>'timezone',(s->>'timestamp')::timestamptz,s) on conflict(id) do nothing;
 if s->>'sourceType'='USER_CORRECTED' then insert into public.user_corrections(id,observation_id,supersedes) values((s->>'id')::uuid,oid,(s->>'supersedes')::uuid) on conflict(id) do nothing;end if;
 end loop;
 phase:=entry->'lunar';
 insert into public.lunar_context(observation_id,phase,illumination,lunar_age,cycle,ephemeris_version,data) values(oid,(phase->>'phase')::integer,(phase->>'illumination')::double precision,(phase->>'age')::double precision,(phase->>'cycle')::integer,phase->>'version',phase) on conflict(observation_id) do nothing;
 if entry->'journal' is null or entry->'journal'='null'::jsonb then delete from public.private_journals where observation_id=oid;
 else insert into public.private_journals(observation_id,ciphertext) values(oid,entry->'journal') on conflict(observation_id) do update set ciphertext=excluded.ciphertext,updated_at=now();end if;
end $$;

create function public.list_observations() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(o.data || jsonb_build_object('journal',j.ciphertext) order by o.local_date desc),'[]'::jsonb) from public.daily_observations o left join public.private_journals j on j.observation_id=o.id
$$;
create function public.delete_history() returns void language sql security invoker set search_path=public,pg_temp as $$delete from public.daily_observations where person_id=public.my_person_id()$$;
create function public.claim_ai_request() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid; count_now integer; permission boolean;
begin
 if auth.uid() is null then return false;end if;
 select person_id into pid from public.profiles where user_id=auth.uid();if pid is null then return false;end if;
 select granted into permission from public.consents where person_id=pid and purpose='OPTIONAL_AI_TEXT_PROCESSING' order by timestamp desc limit 1;
 if permission is distinct from true then return false;end if;
 insert into public.ai_usage(person_id,day,requests) values(pid,current_date,1)
 on conflict(person_id,day) do update set requests=public.ai_usage.requests+1 where public.ai_usage.requests<20 returning requests into count_now;
 return count_now is not null;
end $$;
revoke all on function public.record_consent(jsonb),public.save_observation(jsonb),public.list_observations(),public.delete_history(),public.claim_ai_request() from public;
grant execute on function public.record_consent(jsonb),public.save_observation(jsonb),public.list_observations(),public.delete_history(),public.claim_ai_request() to authenticated;
commit;

-- Additive V2 migration. V1 private tables/policies are unchanged.
begin;
create table public.cities(id text primary key,name text not null,country text not null,country_code text not null,timezone text not null,latitude numeric not null,longitude numeric not null,region text not null);
create table public.daily_prompts(id integer primary key,body text not null,version text not null default 'curated-1');
create table public.public_moments(
 id uuid primary key default gen_random_uuid(),city_id text not null references public.cities(id),prompt_id integer not null references public.daily_prompts(id),
 feeling text check(feeling in ('peaceful','alive','connected','heavy','tired','hopeful','restless','calm','excited','drained','warm','chaotic')),
 caption text not null default '' check(char_length(caption)<=180),language text not null default 'und',visibility text not null check(visibility in ('city','global')),
 submitted_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '48 hours'),moderation_state text not null default 'pending' check(moderation_state in ('pending','approved','rejected')),media_id uuid,
 check(expires_at<=submitted_at+interval '48 hours')
);
create index public_moments_feed on public.public_moments(submitted_at desc,id desc) where moderation_state='approved';
create index public_moments_city on public.public_moments(city_id,submitted_at desc,id desc);
create table public.moment_ownership(moment_id uuid primary key references public.public_moments(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade);
create index moment_owner_user on public.moment_ownership(user_id,moment_id);
create table public.moment_media(id uuid primary key,moment_id uuid not null unique references public.public_moments(id) on delete cascade,storage_path text not null unique,mime_type text not null check(mime_type='image/webp'),width integer not null,height integer not null,bytes integer not null,metadata_stripped boolean not null check(metadata_stripped));
create table public.moderation_results(id uuid primary key default gen_random_uuid(),moment_id uuid not null references public.public_moments(id) on delete cascade,state text not null check(state in ('pending','approved','rejected')),provider text not null,version text not null,reason text not null,created_at timestamptz not null default now());
create table public.content_reports(id uuid primary key default gen_random_uuid(),moment_id uuid not null references public.public_moments(id) on delete cascade,reporter_id uuid not null references auth.users(id) on delete cascade,reason text not null check(reason in ('privacy','harmful','spam')),created_at timestamptz not null default now(),unique(moment_id,reporter_id));
create table public.public_reactions(moment_id uuid not null references public.public_moments(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(moment_id,user_id));
create table public.public_action_usage(user_id uuid not null references auth.users(id) on delete cascade,day date not null,action text not null,requests integer not null,primary key(user_id,day,action));
create table public.media_deletion_queue(id uuid primary key default gen_random_uuid(),storage_path text not null unique,created_at timestamptz not null default now());
create table public.city_pulse_snapshots(city_id text not null references public.cities(id),window_start timestamptz not null,window_end timestamptz not null,sample_count integer not null,dimensions jsonb not null,dimension_counts jsonb not null,confidence text not null,atmosphere_label text not null,calculation_version text not null,primary key(city_id,window_end));
create table public.product_daily_metrics(day date not null,event text not null,total bigint not null default 0,primary key(day,event));
-- Private body-cycle architecture only. No collector or public policy is enabled.
create table public.private_body_cycle_events(id uuid primary key default gen_random_uuid(),person_id uuid not null references public.profiles(person_id) on delete cascade,kind text not null check(kind in ('period-start','period-end')),local_date date not null,timezone text not null,created_at timestamptz not null default now(),consent_version text not null,schema_version integer not null default 1);

create function public.owns_moment(mid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.moment_ownership where moment_id=mid and user_id=auth.uid())$$;
revoke all on function public.owns_moment(uuid) from public;grant execute on function public.owns_moment(uuid) to authenticated;
alter table public.cities enable row level security;alter table public.daily_prompts enable row level security;
create policy city_directory on public.cities for select to anon,authenticated using(true);
create policy prompt_library on public.daily_prompts for select to anon,authenticated using(true);
alter table public.public_moments enable row level security;
create policy public_approved on public.public_moments for select to anon,authenticated using(moderation_state='approved' and expires_at>now() and submitted_at<=now());
create policy author_read on public.public_moments for select to authenticated using(public.owns_moment(id));
alter table public.moment_ownership enable row level security;
create policy owner_map on public.moment_ownership for select to authenticated using(user_id=auth.uid());
do $$ declare tab text;begin foreach tab in array array['moment_media','moderation_results','content_reports','public_reactions','public_action_usage','media_deletion_queue','city_pulse_snapshots','product_daily_metrics','private_body_cycle_events'] loop execute format('alter table public.%I enable row level security',tab);end loop;end $$;
create policy own_reactions on public.public_reactions for select to authenticated using(user_id=auth.uid());
create policy own_reports on public.content_reports for select to authenticated using(reporter_id=auth.uid());
create policy private_cycles on public.private_body_cycle_events for select to authenticated using(person_id=public.my_person_id());
revoke all on public.cities,public.daily_prompts,public.public_moments,public.moment_ownership,public.moment_media,public.moderation_results,public.content_reports,public.public_reactions,public.public_action_usage,public.media_deletion_queue,public.city_pulse_snapshots,public.product_daily_metrics,public.private_body_cycle_events from anon,authenticated;
grant select on public.cities,public.daily_prompts,public.public_moments to anon,authenticated;
grant select on public.moment_ownership,public.content_reports,public.public_reactions,public.private_body_cycle_events to authenticated;

create function public.claim_world_action(kind text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare lim integer;amount integer;begin
 if auth.uid() is null then return false;end if;
 lim:=case kind when 'submit' then 5 when 'report' then 20 when 'react' then 100 else 0 end;if lim=0 then return false;end if;
 insert into public.public_action_usage(user_id,day,action,requests) values(auth.uid(),(now() at time zone 'UTC')::date,kind,1)
 on conflict(user_id,day,action) do update set requests=public.public_action_usage.requests+1 where public.public_action_usage.requests<lim returning requests into amount;return amount is not null;
end $$;
create function public.create_world_moment(owner_id uuid,entry jsonb,media jsonb,review jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare mid uuid:=gen_random_uuid();mediaid uuid;pid integer;begin
 if owner_id is null or not exists(select 1 from auth.users where id=owner_id) then raise exception 'Invalid owner';end if;
 if entry->>'publicConsent' is distinct from 'true' then raise exception 'Public consent required';end if;
 if octet_length(entry::text)>3000 then raise exception 'Invalid entry';end if;
 select (floor(extract(epoch from now())/86400)::bigint%count(*))::integer+1 into pid from public.daily_prompts;
 if media is not null and media<>'null'::jsonb then mediaid:=gen_random_uuid();end if;
 insert into public.public_moments(id,city_id,prompt_id,feeling,caption,language,visibility,media_id) values(mid,entry->>'cityId',pid,entry->>'feeling',entry->>'caption',left(coalesce(entry->>'language','und'),35),entry->>'visibility',mediaid);
 insert into public.moment_ownership values(mid,owner_id);
 if mediaid is not null then insert into public.moment_media(id,moment_id,storage_path,mime_type,width,height,bytes,metadata_stripped) values(mediaid,mid,media->>'path','image/webp',(media->>'width')::integer,(media->>'height')::integer,(media->>'bytes')::integer,true);end if;
 insert into public.moderation_results(moment_id,state,provider,version,reason) values(mid,'pending',coalesce(review->>'provider','unconfigured'),coalesce(review->>'version','1'),left(coalesce(review->>'reason','Awaiting review'),300));
 return mid;
end $$;
-- Only the trusted service role can publish or review. Anonymous/authenticated clients cannot invoke this.
create function public.review_world_moment(mid uuid,decision text,reviewer text,review_version text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if decision not in ('approved','rejected','pending') then raise exception 'Invalid decision';end if;
 update public.public_moments set moderation_state=decision where id=mid and expires_at>now();if not found then raise exception 'Missing or expired moment';end if;
 insert into public.moderation_results(moment_id,state,provider,version,reason) values(mid,decision,left(reviewer,100),left(review_version,50),'Moderation decision');
end $$;
create function public.report_world_moment(mid uuid,report_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.claim_world_action('report') then raise exception 'Rate or auth limit';end if;
 if not exists(select 1 from public.public_moments where id=mid and moderation_state='approved' and expires_at>now()) then raise exception 'Not public';end if;
 insert into public.content_reports(moment_id,reporter_id,reason) values(mid,auth.uid(),report_reason) on conflict(moment_id,reporter_id) do nothing;
 if (select count(*) from public.content_reports where moment_id=mid)>=3 then update public.public_moments set moderation_state='pending' where id=mid;insert into public.moderation_results(moment_id,state,provider,version,reason) values(mid,'pending','community-reports','1','Three distinct reports');end if;
end $$;
create function public.react_world_moment(mid uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.claim_world_action('react') then raise exception 'Rate or auth limit';end if;
 if not exists(select 1 from public.public_moments where id=mid and moderation_state='approved' and expires_at>now()) then raise exception 'Not public';end if;
 if exists(select 1 from public.public_reactions where moment_id=mid and user_id=auth.uid()) then delete from public.public_reactions where moment_id=mid and user_id=auth.uid();return false;end if;
 insert into public.public_reactions(moment_id,user_id) values(mid,auth.uid());return true;
end $$;
create function public.delete_world_moment(mid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if auth.uid() is null or not public.owns_moment(mid) then raise exception 'Unauthorized';end if;delete from public.public_moments where id=mid;end $$;
-- Cascading account deletion must remove public rows, not merely orphan the ownership mapping.
create function public.remove_owned_moments() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.public_moments where id in(select moment_id from public.moment_ownership where user_id=old.id);return old;end $$;
create trigger remove_world_on_account_delete before delete on auth.users for each row execute function public.remove_owned_moments();
create function public.queue_media_deletion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin insert into public.media_deletion_queue(storage_path) values(old.storage_path) on conflict(storage_path) do nothing;return old;end $$;
create trigger erase_moment_media before delete on public.moment_media for each row execute function public.queue_media_deletion();
create function public.expire_world_moments() returns void language sql security definer set search_path=public,pg_temp as $$delete from public.public_moments where expires_at<=now()$$;
create function public.world_feed(city text default null,before_time timestamptz default null,before_id uuid default null,prompt integer default null) returns setof public.public_moments language sql stable security invoker set search_path=public,pg_temp as $$
 select * from public.public_moments where moderation_state='approved' and expires_at>now() and submitted_at<=now() and (case when city is null then visibility='global' else city_id=city end) and (before_time is null or (submitted_at,id)<(before_time,before_id)) and (prompt is null or prompt_id=prompt) order by submitted_at desc,id desc limit 21
$$;
-- Public aggregate contains no ownership, private observations, notes, bodies, or small-sample dimensions.
create function public.world_pulses() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with latest as (select distinct on (m.city_id,o.user_id) m.city_id,o.user_id,m.feeling from public.public_moments m join public.moment_ownership o on o.moment_id=m.id where m.moderation_state='approved' and m.expires_at>now() and m.submitted_at>now()-interval '24 hours' and m.submitted_at<=now() order by m.city_id,o.user_id,m.submitted_at desc,m.id desc),
 vectors as (select city_id,feeling,case when feeling in ('peaceful','alive','connected','hopeful','warm') then 4 when feeling='excited' then 5 when feeling='heavy' then 2 end as valence,case when feeling in ('alive','excited') then 5 when feeling in ('heavy','tired') then 2 when feeling='drained' then 1 end as energy,case when feeling in ('peaceful','calm') then 5 when feeling in ('restless','chaotic') then 1 end as calmness,case when feeling in ('peaceful','calm') then 1 when feeling='restless' then 4 when feeling='chaotic' then 5 end as tension,case when feeling='connected' then 5 when feeling='warm' then 4 end as connection,case when feeling='tired' then 4 when feeling='drained' then 5 end as fatigue from latest),
 grouped as (select city_id,count(*) n,jsonb_build_object('valence',avg(valence),'energy',avg(energy),'calmness',avg(calmness),'tension',avg(tension),'connection',avg(connection),'fatigue',avg(fatigue)) means,jsonb_build_object('valence',count(valence),'energy',count(energy),'calmness',count(calmness),'tension',count(tension),'connection',count(connection),'fatigue',count(fatigue)) counts from vectors group by city_id)
 select coalesce(jsonb_agg(jsonb_build_object('cityId',city_id,'sampleCount',n,'dimensions',case when n>=20 then (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(means) where (counts->>key)::integer>=20) else '{}'::jsonb end,'dimensionCounts',case when n>=20 then (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(counts) where value::text::integer>=20) else '{}'::jsonb end,'windowStart',now()-interval '24 hours','windowEnd',now(),'version','pulse-1','confidence',case when n>=20 then 'limited' else 'insufficient' end)),'[]'::jsonb) from grouped
$$;
revoke all on function public.claim_world_action(text),public.create_world_moment(uuid,jsonb,jsonb,jsonb),public.review_world_moment(uuid,text,text,text),public.report_world_moment(uuid,text),public.react_world_moment(uuid),public.delete_world_moment(uuid),public.expire_world_moments(),public.world_feed(text,timestamptz,uuid,integer),public.world_pulses(),public.remove_owned_moments(),public.queue_media_deletion() from public;
grant execute on function public.claim_world_action(text),public.report_world_moment(uuid,text),public.react_world_moment(uuid),public.delete_world_moment(uuid) to authenticated;
grant execute on function public.world_feed(text,timestamptz,uuid,integer),public.world_pulses() to anon,authenticated,service_role;
grant execute on function public.create_world_moment(uuid,jsonb,jsonb,jsonb),public.review_world_moment(uuid,text,text,text),public.expire_world_moments() to service_role;
grant all on public.public_moments,public.moment_ownership,public.moment_media,public.moderation_results,public.media_deletion_queue,public.city_pulse_snapshots,public.product_daily_metrics to service_role;

-- Versioned launch directory and curated prompt library.
insert into public.cities values('tokyo-jp','Tokyo','Japan','JP','Asia/Tokyo','35.68','139.69','Asia');
insert into public.cities values('mumbai-in','Mumbai','India','IN','Asia/Kolkata','19.08','72.88','Asia');
insert into public.cities values('london-gb','London','United Kingdom','GB','Europe/London','51.51','-0.13','Europe');
insert into public.cities values('lisbon-pt','Lisbon','Portugal','PT','Europe/Lisbon','38.72','-9.14','Europe');
insert into public.cities values('new-york-us','New York','United States','US','America/New_York','40.71','-74.01','Americas');
insert into public.cities values('paris-fr','Paris','France','FR','Europe/Paris','48.86','2.35','Europe');
insert into public.cities values('berlin-de','Berlin','Germany','DE','Europe/Berlin','52.52','13.4','Europe');
insert into public.cities values('toronto-ca','Toronto','Canada','CA','America/Toronto','43.65','-79.38','Americas');
insert into public.cities values('sao-paulo-br','São Paulo','Brazil','BR','America/Sao_Paulo','-23.55','-46.63','Americas');
insert into public.cities values('dubai-ae','Dubai','United Arab Emirates','AE','Asia/Dubai','25.2','55.27','Asia');
insert into public.cities values('singapore-sg','Singapore','Singapore','SG','Asia/Singapore','1.35','103.82','Asia');
insert into public.cities values('edmonton-ca','Edmonton','Canada','CA','America/Edmonton','53.55','-113.49','Americas');
insert into public.cities values('tehran-ir','Tehran','Iran','IR','Asia/Tehran','35.69','51.39','Asia');
insert into public.cities values('delhi-in','Delhi','India','IN','Asia/Kolkata','28.61','77.21','Asia');
insert into public.cities values('ahmedabad-in','Ahmedabad','India','IN','Asia/Kolkata','23.02','72.57','Asia');
insert into public.cities values('bengaluru-in','Bengaluru','India','IN','Asia/Kolkata','12.97','77.59','Asia');
insert into public.cities values('chennai-in','Chennai','India','IN','Asia/Kolkata','13.08','80.27','Asia');
insert into public.cities values('kolkata-in','Kolkata','India','IN','Asia/Kolkata','22.57','88.36','Asia');
insert into public.cities values('pune-in','Pune','India','IN','Asia/Kolkata','18.52','73.86','Asia');
insert into public.cities values('hyderabad-in','Hyderabad','India','IN','Asia/Kolkata','17.39','78.49','Asia');
insert into public.cities values('seoul-kr','Seoul','South Korea','KR','Asia/Seoul','37.57','126.98','Asia');
insert into public.cities values('bangkok-th','Bangkok','Thailand','TH','Asia/Bangkok','13.76','100.5','Asia');
insert into public.cities values('jakarta-id','Jakarta','Indonesia','ID','Asia/Jakarta','-6.21','106.85','Asia');
insert into public.cities values('manila-ph','Manila','Philippines','PH','Asia/Manila','14.6','120.98','Asia');
insert into public.cities values('taipei-tw','Taipei','Taiwan','TW','Asia/Taipei','25.03','121.57','Asia');
insert into public.cities values('hong-kong-hk','Hong Kong','Hong Kong','HK','Asia/Hong_Kong','22.32','114.17','Asia');
insert into public.cities values('shanghai-cn','Shanghai','China','CN','Asia/Shanghai','31.23','121.47','Asia');
insert into public.cities values('beijing-cn','Beijing','China','CN','Asia/Shanghai','39.9','116.41','Asia');
insert into public.cities values('hanoi-vn','Hanoi','Vietnam','VN','Asia/Ho_Chi_Minh','21.03','105.85','Asia');
insert into public.cities values('istanbul-tr','Istanbul','Türkiye','TR','Europe/Istanbul','41.01','28.98','Europe');
insert into public.cities values('rome-it','Rome','Italy','IT','Europe/Rome','41.9','12.5','Europe');
insert into public.cities values('madrid-es','Madrid','Spain','ES','Europe/Madrid','40.42','-3.7','Europe');
insert into public.cities values('barcelona-es','Barcelona','Spain','ES','Europe/Madrid','41.39','2.17','Europe');
insert into public.cities values('amsterdam-nl','Amsterdam','Netherlands','NL','Europe/Amsterdam','52.37','4.9','Europe');
insert into public.cities values('stockholm-se','Stockholm','Sweden','SE','Europe/Stockholm','59.33','18.07','Europe');
insert into public.cities values('oslo-no','Oslo','Norway','NO','Europe/Oslo','59.91','10.75','Europe');
insert into public.cities values('copenhagen-dk','Copenhagen','Denmark','DK','Europe/Copenhagen','55.68','12.57','Europe');
insert into public.cities values('warsaw-pl','Warsaw','Poland','PL','Europe/Warsaw','52.23','21.01','Europe');
insert into public.cities values('prague-cz','Prague','Czechia','CZ','Europe/Prague','50.08','14.44','Europe');
insert into public.cities values('vienna-at','Vienna','Austria','AT','Europe/Vienna','48.21','16.37','Europe');
insert into public.cities values('athens-gr','Athens','Greece','GR','Europe/Athens','37.98','23.73','Europe');
insert into public.cities values('dublin-ie','Dublin','Ireland','IE','Europe/Dublin','53.35','-6.26','Europe');
insert into public.cities values('lagos-ng','Lagos','Nigeria','NG','Africa/Lagos','6.52','3.38','Africa');
insert into public.cities values('nairobi-ke','Nairobi','Kenya','KE','Africa/Nairobi','-1.29','36.82','Africa');
insert into public.cities values('cape-town-za','Cape Town','South Africa','ZA','Africa/Johannesburg','-33.92','18.42','Africa');
insert into public.cities values('cairo-eg','Cairo','Egypt','EG','Africa/Cairo','30.04','31.24','Africa');
insert into public.cities values('accra-gh','Accra','Ghana','GH','Africa/Accra','5.6','-0.19','Africa');
insert into public.cities values('marrakesh-ma','Marrakesh','Morocco','MA','Africa/Casablanca','31.63','-7.98','Africa');
insert into public.cities values('mexico-city-mx','Mexico City','Mexico','MX','America/Mexico_City','19.43','-99.13','Americas');
insert into public.cities values('buenos-aires-ar','Buenos Aires','Argentina','AR','America/Argentina/Buenos_Aires','-34.6','-58.38','Americas');
insert into public.cities values('bogota-co','Bogotá','Colombia','CO','America/Bogota','4.71','-74.07','Americas');
insert into public.cities values('lima-pe','Lima','Peru','PE','America/Lima','-12.05','-77.04','Americas');
insert into public.cities values('santiago-cl','Santiago','Chile','CL','America/Santiago','-33.45','-70.67','Americas');
insert into public.cities values('vancouver-ca','Vancouver','Canada','CA','America/Vancouver','49.28','-123.12','Americas');
insert into public.cities values('montreal-ca','Montréal','Canada','CA','America/Toronto','45.5','-73.57','Americas');
insert into public.cities values('los-angeles-us','Los Angeles','United States','US','America/Los_Angeles','34.05','-118.24','Americas');
insert into public.cities values('san-francisco-us','San Francisco','United States','US','America/Los_Angeles','37.77','-122.42','Americas');
insert into public.cities values('chicago-us','Chicago','United States','US','America/Chicago','41.88','-87.63','Americas');
insert into public.cities values('sydney-au','Sydney','Australia','AU','Australia/Sydney','-33.87','151.21','Oceania');
insert into public.cities values('melbourne-au','Melbourne','Australia','AU','Australia/Melbourne','-37.81','144.96','Oceania');
insert into public.cities values('auckland-nz','Auckland','New Zealand','NZ','Pacific/Auckland','-36.85','174.76','Oceania');
insert into public.cities values('honolulu-us','Honolulu','United States','US','Pacific/Honolulu','21.31','-157.86','Oceania');
insert into public.cities values('kathmandu-np','Kathmandu','Nepal','NP','Asia/Kathmandu','27.72','85.32','Asia');
insert into public.cities values('dhaka-bd','Dhaka','Bangladesh','BD','Asia/Dhaka','23.81','90.41','Asia');
insert into public.cities values('karachi-pk','Karachi','Pakistan','PK','Asia/Karachi','24.86','67.01','Asia');
insert into public.cities values('colombo-lk','Colombo','Sri Lanka','LK','Asia/Colombo','6.93','79.86','Asia');
insert into public.daily_prompts(id,body) values(1,'Show us a small thing that made today better.');
insert into public.daily_prompts(id,body) values(2,'What does a quiet moment look like where you are?');
insert into public.daily_prompts(id,body) values(3,'Find a little colour in your day.');
insert into public.daily_prompts(id,body) values(4,'What is on your table today?');
insert into public.daily_prompts(id,body) values(5,'Show us something you passed on your way.');
insert into public.daily_prompts(id,body) values(6,'Where did the light fall today?');
insert into public.daily_prompts(id,body) values(7,'What is a small comfort in your city?');
insert into public.daily_prompts(id,body) values(8,'Show us a texture you noticed.');
insert into public.daily_prompts(id,body) values(9,'What does a pause look like today?');
insert into public.daily_prompts(id,body) values(10,'Find something growing near you.');
insert into public.daily_prompts(id,body) values(11,'What made you slow down for a moment?');
insert into public.daily_prompts(id,body) values(12,'Show us your city through a reflection.');
insert into public.daily_prompts(id,body) values(13,'What does the sky look like from a public place?');
insert into public.daily_prompts(id,body) values(14,'What ordinary thing deserves a second look?');
insert into public.daily_prompts(id,body) values(15,'Show us a corner that feels welcoming.');
insert into public.daily_prompts(id,body) values(16,'What is a little sign of the season?');
insert into public.daily_prompts(id,body) values(17,'Find a pattern in the everyday.');
insert into public.daily_prompts(id,body) values(18,'What is keeping you company today?');
insert into public.daily_prompts(id,body) values(19,'Show us something made by hand.');
insert into public.daily_prompts(id,body) values(20,'What does the start of your day look like?');
insert into public.daily_prompts(id,body) values(21,'Find a bit of green in your surroundings.');
insert into public.daily_prompts(id,body) values(22,'What does the end of a busy day look like?');
insert into public.daily_prompts(id,body) values(23,'Show us a small detail of your city.');
insert into public.daily_prompts(id,body) values(24,'What is something simple you enjoyed?');
insert into public.daily_prompts(id,body) values(25,'Find a place where the light feels warm.');
insert into public.daily_prompts(id,body) values(26,'What is the view on a short walk?');
insert into public.daily_prompts(id,body) values(27,'Show us something with a story, without sharing the story.');
insert into public.daily_prompts(id,body) values(28,'What did you stop to appreciate?');
insert into public.daily_prompts(id,body) values(29,'Find something blue around you.');
insert into public.daily_prompts(id,body) values(30,'What is a familiar sight you still enjoy?');
insert into public.daily_prompts(id,body) values(31,'Show us an everyday ritual.');
insert into public.daily_prompts(id,body) values(32,'What does a little fresh air look like?');
insert into public.daily_prompts(id,body) values(33,'Find beauty in something useful.');
insert into public.daily_prompts(id,body) values(34,'What is on the horizon today?');
insert into public.daily_prompts(id,body) values(35,'Show us something that feels soft.');
insert into public.daily_prompts(id,body) values(36,'What made your surroundings feel alive?');
insert into public.daily_prompts(id,body) values(37,'Find an unexpected shape.');
insert into public.daily_prompts(id,body) values(38,'What is a small bright spot in your day?');
insert into public.daily_prompts(id,body) values(39,'Show us a path you like taking.');
insert into public.daily_prompts(id,body) values(40,'What does the afternoon light look like?');
insert into public.daily_prompts(id,body) values(41,'Find two colours that belong together.');
insert into public.daily_prompts(id,body) values(42,'What is a small thing you are looking forward to?');
insert into public.daily_prompts(id,body) values(43,'Show us a detail at street level.');
insert into public.daily_prompts(id,body) values(44,'What gives your day a little rhythm?');
insert into public.daily_prompts(id,body) values(45,'Find something that catches the light.');
insert into public.daily_prompts(id,body) values(46,'What does a restful space look like?');
insert into public.daily_prompts(id,body) values(47,'Show us a favourite everyday object.');
insert into public.daily_prompts(id,body) values(48,'What did you notice above you?');
insert into public.daily_prompts(id,body) values(49,'Find a little warmth in an ordinary day.');
insert into public.daily_prompts(id,body) values(50,'What is something you saw for the first time today?');
insert into public.daily_prompts(id,body) values(51,'Show us a place to take a breath.');
insert into public.daily_prompts(id,body) values(52,'What does your city look like in shadow?');
insert into public.daily_prompts(id,body) values(53,'Find something that makes you curious.');
insert into public.daily_prompts(id,body) values(54,'What is a small thing that feels like home?');
insert into public.daily_prompts(id,body) values(55,'Show us something pleasantly imperfect.');
insert into public.daily_prompts(id,body) values(56,'What did the weather leave behind in a public place?');
insert into public.daily_prompts(id,body) values(57,'Find a detail most people walk past.');
insert into public.daily_prompts(id,body) values(58,'What does your next cup of something look like?');
insert into public.daily_prompts(id,body) values(59,'Show us a moment between one thing and the next.');
insert into public.daily_prompts(id,body) values(60,'What is a small sign of care around you?');
insert into public.daily_prompts(id,body) values(61,'Find something that moves gently.');
insert into public.daily_prompts(id,body) values(62,'What colour would you give today?');
insert into public.daily_prompts(id,body) values(63,'Show us an ordinary view you appreciate.');
insert into public.daily_prompts(id,body) values(64,'What would you like to notice more tomorrow?');
commit;

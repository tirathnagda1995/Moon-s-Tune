-- Supabase Storage migration; separate from portable SQL domain tests.
-- No client upload/read policy: all access passes through verified, bounded server routes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('moment-quarantine','moment-quarantine',false,3000000,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=3000000,allowed_mime_types=array['image/webp'];

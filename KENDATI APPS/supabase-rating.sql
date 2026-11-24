-- =====================================================================
-- RATING & SARAN APLIKASI KENDATI (Android & iOS)
-- Jalankan SEKALI di Supabase -> SQL Editor (proyek yang sama dengan
-- penghitung pengunjung KENDATI), lalu Run.
-- =====================================================================

create table if not exists app_feedback (
  id          bigserial primary key,
  device_id   text        not null,
  platform    text        not null check (platform in ('android', 'ios')),
  rating      smallint    not null check (rating between 1 and 5),
  comment     text        check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (device_id, platform)          -- 1 HP = 1 rating per platform (bisa diubah)
);

-- tabel tidak bisa dibaca/ditulis langsung oleh publik
alter table app_feedback enable row level security;

-- yang publik hanya ringkasan tanpa id perangkat
create or replace view app_feedback_public
  with (security_invoker = false) as
  select platform, rating, comment, updated_at as created_at
  from app_feedback;
grant select on app_feedback_public to anon;

-- kirim / ubah rating dari aplikasi
create or replace function submit_feedback(
  p_device text, p_platform text, p_rating int, p_comment text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 then
    raise exception 'device_id tidak valid';
  end if;
  insert into app_feedback (device_id, platform, rating, comment)
  values (p_device, p_platform, p_rating,
          nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (device_id, platform) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        updated_at = now();
end;
$$;
grant execute on function submit_feedback(text, text, int, text) to anon;

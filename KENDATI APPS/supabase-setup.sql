-- =====================================================================
-- SETUP SUPABASE KENDATI (jalankan SEKALI, aman diulang)
-- Supabase -> SQL Editor -> New query -> tempel SEMUA isi file ini -> Run
--
-- 1) Statistik pengunjung pakai tanggal WIB (Asia/Jakarta)
-- 2) Rating & saran aplikasi
-- 3) Jumlah unduhan APK & IPA
-- =====================================================================

-- ---------- 1) PENGUNJUNG: tanggal WIB ----------
create or replace function record_visit()
returns void
language plpgsql
security definer
as $$
begin
  update visit_total set count = count + 1 where id = 1;

  insert into visit_daily (day, count)
    values ((now() at time zone 'Asia/Jakarta')::date, 1)
    on conflict (day) do update set count = visit_daily.count + 1;

  insert into visit_monthly (month, count)
    values (date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date, 1)
    on conflict (month) do update set count = visit_monthly.count + 1;
end;
$$;

-- ---------- 2) + 3) RATING, SARAN & UNDUHAN ----------
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

-- =====================================================================
-- JUMLAH UNDUHAN (tidak hilang walau APK/IPA dibangun ulang)
-- =====================================================================
create table if not exists app_downloads (
  platform text primary key check (platform in ('android', 'ios')),
  count    bigint not null default 0
);
insert into app_downloads (platform) values ('android'), ('ios') on conflict do nothing;
alter table app_downloads enable row level security;
drop policy if exists "publik boleh baca unduhan" on app_downloads;
create policy "publik boleh baca unduhan" on app_downloads for select using (true);

create or replace function record_download(p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update app_downloads set count = count + 1 where platform = p_platform;
end;
$$;
grant execute on function record_download(text) to anon;

-- ================== LOG KENDATI (semua kegiatan pengguna) ==================
-- Diterapkan lewat migrasi "log_kendati_aktivitas". Lihat isinya di view log_kendati_wib.
-- Tabel public.log_kendati (user_id, user_name, user_email, aksi, menu, detail, url, platform, created_at)
-- RPC public.record_activity(p_aksi, p_menu, p_detail, p_url, p_platform) — hanya pengguna yang sudah login Google.

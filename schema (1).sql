-- Jalankan seluruh file ini di Supabase > SQL Editor > New query > Run

create table admins (user_id uuid primary key references auth.users on delete cascade);

create function is_admin() returns boolean language sql security definer stable
set search_path = public as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,            -- format 62xxxxxxxxxx
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  app_name text not null,
  start_date date not null,
  expires_on date not null,
  note text,
  status text not null default 'belum_diingatkan'
    check (status in ('belum_diingatkan','sudah_diingatkan','sudah_renew','tidak_renew')),
  created_at timestamptz default now()
);

create table renewals (                  -- riwayat renewal
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions on delete cascade,
  old_start date, old_expires date, new_start date not null, new_expires date not null,
  created_at timestamptz default now()
);

create table notification_log (          -- tahap 2: riwayat notifikasi (1 baris per hari)
  id uuid primary key default gen_random_uuid(),
  sent_on date unique not null, account_count int, created_at timestamptz default now()
);

create table push_subscriptions (        -- tahap 2: perangkat admin
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  endpoint text unique not null, subscription jsonb not null, created_at timestamptz default now()
);

create index on subscriptions (expires_on);

-- Row Level Security: hanya admin yang boleh akses
do $$ declare t text; begin
  foreach t in array array['customers','subscriptions','renewals','notification_log','push_subscriptions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin_all" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
alter table admins enable row level security;
create policy "baca_diri_sendiri" on admins for select using (user_id = auth.uid());

-- SETELAH membuat user admin di Authentication > Users, jalankan ini (ganti emailnya):
-- insert into admins (user_id) select id from auth.users where email = 'emailkamu@gmail.com';

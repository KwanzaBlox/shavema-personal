-- ============================================================
-- «Шаверма персонал» — схема базы данных Supabase (PostgreSQL)
-- Как использовать: создай проект в Supabase, открой раздел
-- SQL Editor → New query, вставь весь этот файл и нажми Run.
-- ============================================================

-- Роли пользователя: 'admin' | 'employee'
-- Роль на смене:     'main'  | 'extra'
-- Статус дня:        'work' | 'dayoff' | 'vacation' | 'sick'

-- ---------- 1. Профили сотрудников ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  short_name text not null,
  slug text unique,
  role text not null default 'employee'
    check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- ---------- 2. Смены ----------
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  shift_date date not null,
  hours numeric(5, 1) not null check (hours > 0 and hours <= 24),
  role text not null default 'main' check (role in ('main', 'extra')),
  worked_alone boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. Статусы дней ----------
create table if not exists public.day_status (
  id uuid primary key default gen_random_uuid(),
  status_date date not null unique,
  status text not null
    check (status in ('work', 'dayoff', 'vacation', 'sick')),
  updated_at timestamptz not null default now()
);

-- ---------- 4. Дневная касса (одна запись на день) ----------
create table if not exists public.daily_cash (
  id uuid primary key default gen_random_uuid(),
  cash_date date not null unique,
  amount numeric(12, 2) not null check (amount >= 0),
  author_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- 5. Месячные планы ----------
create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  plan_month text not null unique, -- формат 'YYYY-MM'
  amount numeric(12, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- 6. Настройки (одна строка) ----------
create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  base_rate numeric(10, 2) not null default 170,
  solo_multiplier numeric(4, 2) not null default 1.5,
  long_shift_threshold numeric(5, 1) not null default 12,
  premium_tiers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- 7. Уведомления ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 8. Сообщения поддержки ----------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  reply text,
  replied_at timestamptz
);

-- ---------- 9. История изменений ----------
create table if not exists public.change_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  entity text not null,
  entity_id text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Функция проверки роли администратора
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- Автосоздание профиля при регистрации пользователя.
-- Новый пользователь получает роль 'employee'.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, short_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Сотрудник'),
    coalesce(new.raw_user_meta_data ->> 'short_name', '?'),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Включение Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.day_status enable row level security;
alter table public.daily_cash enable row level security;
alter table public.monthly_plans enable row level security;
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;
alter table public.change_history enable row level security;

-- ---------- profiles ----------
-- Каждый видит себя; администратор видит всех.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Пользователь может менять только свои данные и не может сам менять роль.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Администратор меняет чужие профили (в том числе роли), но не себя.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin() and id <> auth.uid());

-- ---------- shifts ----------
-- Сотрудник видит и правит только свои смены; администратор — все.
drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select" on public.shifts
  for select using (employee_id = auth.uid() or public.is_admin());

drop policy if exists "shifts_insert" on public.shifts;
create policy "shifts_insert" on public.shifts
  for insert with check (employee_id = auth.uid() or public.is_admin());

drop policy if exists "shifts_update" on public.shifts;
create policy "shifts_update" on public.shifts
  for update using (employee_id = auth.uid() or public.is_admin());

drop policy if exists "shifts_delete" on public.shifts;
create policy "shifts_delete" on public.shifts
  for delete using (employee_id = auth.uid() or public.is_admin());

-- ---------- day_status ----------
-- Статусы дней видят все, меняет только администратор.
drop policy if exists "day_status_select" on public.day_status;
create policy "day_status_select" on public.day_status
  for select using (true);

drop policy if exists "day_status_write" on public.day_status;
create policy "day_status_write" on public.day_status
  for all using (public.is_admin());

-- ---------- daily_cash ----------
-- Дневную кассу видят все, меняет только администратор.
drop policy if exists "daily_cash_select" on public.daily_cash;
create policy "daily_cash_select" on public.daily_cash
  for select using (true);

drop policy if exists "daily_cash_write" on public.daily_cash;
create policy "daily_cash_write" on public.daily_cash
  for all using (public.is_admin());

-- ---------- monthly_plans ----------
drop policy if exists "monthly_plans_select" on public.monthly_plans;
create policy "monthly_plans_select" on public.monthly_plans
  for select using (true);

drop policy if exists "monthly_plans_write" on public.monthly_plans;
create policy "monthly_plans_write" on public.monthly_plans
  for all using (public.is_admin());

-- ---------- app_settings ----------
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select using (true);

drop policy if exists "app_settings_write" on public.app_settings;
create policy "app_settings_write" on public.app_settings
  for all using (public.is_admin());

-- ---------- notifications ----------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_write" on public.notifications;
create policy "notifications_write" on public.notifications
  for all using (public.is_admin());

-- ---------- support_messages ----------
drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select" on public.support_messages
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "support_messages_insert" on public.support_messages;
create policy "support_messages_insert" on public.support_messages
  for insert with check (user_id = auth.uid());

-- ---------- change_history ----------
drop policy if exists "change_history_select" on public.change_history;
create policy "change_history_select" on public.change_history
  for select using (public.is_admin());

drop policy if exists "change_history_insert" on public.change_history;
create policy "change_history_insert" on public.change_history
  for insert with check (auth.uid() is not null);

-- ============================================================
-- Начальные данные
-- ============================================================
insert into public.app_settings
  (id, base_rate, solo_multiplier, long_shift_threshold, premium_tiers)
values (
  1,
  170,
  1.5,
  12,
  '[{"from":20000,"premium":300},{"from":23000,"premium":500},{"from":26000,"premium":800},{"from":29000,"premium":1000},{"from":32000,"premium":1300},{"from":35000,"premium":1600},{"from":37000,"premium":1900},{"from":40000,"premium":2300}]'::jsonb
)
on conflict (id) do nothing;

-- ============================================================
-- Настройка трёх поваров после создания их аккаунтов.
-- Создай трёх пользователей в Dashboard → Authentication → Users,
-- затем подставь их email и выполни эти запросы.
-- (Роль admin нельзя назначить самому себе — поэтому роль задаётся
--  здесь, через SQL, один раз.)
-- ============================================================
-- update public.profiles p
-- set full_name = 'Рита', short_name = 'Р', slug = 'rita'
-- from auth.users u where p.id = u.id and u.email = 'rita@example.com';
--
-- update public.profiles p
-- set full_name = 'Евгения', short_name = 'Е', slug = 'evgeniya'
-- from auth.users u where p.id = u.id and u.email = 'evgeniya@example.com';
--
-- update public.profiles p
-- set full_name = 'Дмитрий', short_name = 'Д', slug = 'dmitriy', role = 'admin'
-- from auth.users u where p.id = u.id and u.email = 'dmitriy@example.com';

-- ============================================================
-- Realtime: включает мгновенную синхронизацию между устройствами.
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.shifts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.daily_cash; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.monthly_plans; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.app_settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.day_status; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.support_messages; exception when duplicate_object then null; end;
end $$;

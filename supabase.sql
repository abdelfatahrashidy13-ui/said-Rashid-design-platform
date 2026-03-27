
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text default 'free',
  credits integer default 10,
  referral_code text unique,
  referred_by text,
  referral_credits_earned integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  prompt text,
  image_url text,
  result_url text,
  likes integer default 0,
  tool text,
  created_at timestamp with time zone default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, referral_code)
  values (new.id, new.email, substr(md5(random()::text), 1, 8));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

alter table profiles enable row level security;
alter table generations enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "Users can view own generations" on generations;
create policy "Users can view own generations" on generations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own generations" on generations;
create policy "Users can insert own generations" on generations for insert with check (auth.uid() = user_id);

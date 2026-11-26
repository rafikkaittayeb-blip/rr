-- Exchange rate history for LLF Inventory.
-- Run once in Supabase → SQL Editor. After this, when the Accountant (or Owner)
-- saves a new rate, every open screen on every device reprices instantly.

create table if not exists public.exchange_rates (
  id bigint generated always as identity primary key,
  rate numeric(10, 4) not null check (rate > 0),
  note text not null,
  set_by text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists exchange_rates_created_at_idx on public.exchange_rates (created_at desc);

alter table public.exchange_rates enable row level security;

-- The demo app has no login yet, so the browser key may read and add rates.
-- When real logins are added, restrict INSERT to the Accountant and Owner.
drop policy if exists "Anyone can read exchange rates" on public.exchange_rates;
create policy "Anyone can read exchange rates" on public.exchange_rates for select using (true);
drop policy if exists "App can add exchange rates" on public.exchange_rates;
create policy "App can add exchange rates" on public.exchange_rates for insert with check (rate > 0 and length(note) > 0);

-- Push new rows to open browsers (Supabase Realtime).
alter publication supabase_realtime add table public.exchange_rates;

-- Starting rate
insert into public.exchange_rates (rate, note, set_by, source)
select 48.70, 'Opening rate', 'Mme Hoda', 'manual'
where not exists (select 1 from public.exchange_rates);

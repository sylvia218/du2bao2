-- DU2BAO2 V7 safety, seller disclosure and complaint upgrade
-- Run this file ONCE in Supabase Dashboard -> SQL Editor for an existing DU2BAO2 project.
-- It is idempotent and may be run again safely after an interrupted migration.
-- Review the legal text, retention practice and administrator access before public launch.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Public seller disclosure fields
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists seller_type text not null default 'individual';
alter table public.profiles add column if not exists public_email text not null default '';
alter table public.profiles add column if not exists public_phone text not null default '';
alter table public.profiles add column if not exists public_address text not null default '';
alter table public.profiles add column if not exists website_url text not null default '';
alter table public.profiles add column if not exists business_name text not null default '';

update public.profiles
set public_phone = whatsapp
where public_phone = '' and coalesce(whatsapp, '') <> '';

alter table public.profiles drop constraint if exists profiles_seller_type_check;
alter table public.profiles
  add constraint profiles_seller_type_check
  check (seller_type in ('individual', 'business'));

-- ---------------------------------------------------------------------------
-- 2. Restricted seller account records
-- ---------------------------------------------------------------------------
create table if not exists public.seller_private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text not null default '',
  private_phone text not null default '',
  state text not null default '',
  country text not null default 'Malaysia',
  business_registration_no text not null default '',
  identity_reference_last4 text not null default '',
  declaration_accepted boolean not null default false,
  declaration_version text not null default '',
  declaration_at timestamptz,
  retention_until timestamptz not null default (now() + interval '3 years'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_private_id_last4_check check (
    identity_reference_last4 = '' or identity_reference_last4 ~ '^[A-Za-z0-9]{4}$'
  )
);

create index if not exists seller_private_retention_idx
  on public.seller_private_profiles(retention_until);

-- ---------------------------------------------------------------------------
-- 3. Expanded listing disclosures
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists title_en text not null default '';
alter table public.listings add column if not exists description_en text not null default '';
alter table public.listings add column if not exists payment_methods text not null default '';
alter table public.listings add column if not exists delivery_estimate text not null default '';
alter table public.listings add column if not exists sale_terms text not null default '';
alter table public.listings add column if not exists certification_info text not null default '';
alter table public.listings add column if not exists seller_declaration_at timestamptz;

-- Allow the V7 bilingual description form length while preserving validation.
alter table public.listings drop constraint if exists listings_description_check;
alter table public.listings
  add constraint listings_description_check
  check (char_length(description) between 5 and 2500);

-- ---------------------------------------------------------------------------
-- 4. Complaint and listing report records
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_name text not null default '',
  reporter_email text not null,
  reason text not null,
  details text not null,
  evidence_url text not null default '',
  listing_title_snapshot text not null default '',
  listing_url_snapshot text not null default '',
  seller_id_snapshot uuid,
  status text not null default 'open',
  admin_notes text not null default '',
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  retention_until timestamptz not null default (now() + interval '3 years'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_reason_check check (reason in (
    'suspected_counterfeit', 'misleading_information', 'prohibited_item',
    'scam_concern', 'seller_conduct', 'other'
  )),
  constraint reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint reports_email_check check (char_length(reporter_email) between 3 and 160),
  constraint reports_details_check check (char_length(details) between 20 and 2500)
);

create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists reports_listing_idx on public.reports(listing_id);
create index if not exists reports_reporter_idx on public.reports(reporter_user_id);
create index if not exists reports_retention_idx on public.reports(retention_until);

-- ---------------------------------------------------------------------------
-- 5. Listing audit trail for moderation and record review
-- ---------------------------------------------------------------------------
create table if not exists public.listing_audit (
  id bigint generated by default as identity primary key,
  listing_id uuid,
  seller_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  snapshot jsonb not null,
  retention_until timestamptz not null default (now() + interval '3 years'),
  created_at timestamptz not null default now()
);

create index if not exists listing_audit_listing_idx on public.listing_audit(listing_id, created_at desc);
create index if not exists listing_audit_seller_idx on public.listing_audit(seller_id, created_at desc);
create index if not exists listing_audit_retention_idx on public.listing_audit(retention_until);

create or replace function public.capture_listing_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.listing_audit (listing_id, seller_id, action, snapshot)
    values (old.id, old.seller_id, 'delete', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.listing_audit (listing_id, seller_id, action, snapshot)
    values (new.id, new.seller_id, 'update', jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
    return new;
  else
    insert into public.listing_audit (listing_id, seller_id, action, snapshot)
    values (new.id, new.seller_id, 'insert', to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists listings_capture_audit on public.listings;
create trigger listings_capture_audit
after insert or update or delete on public.listings
for each row execute function public.capture_listing_audit();

-- ---------------------------------------------------------------------------
-- 6. Updated-at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists seller_private_profiles_set_updated_at on public.seller_private_profiles;
create trigger seller_private_profiles_set_updated_at
before update on public.seller_private_profiles
for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.seller_private_profiles enable row level security;
alter table public.reports enable row level security;
alter table public.listing_audit enable row level security;

-- Restricted seller records: seller and administrators only.
drop policy if exists "Sellers read own private profile" on public.seller_private_profiles;
create policy "Sellers read own private profile"
on public.seller_private_profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Sellers create own private profile" on public.seller_private_profiles;
create policy "Sellers create own private profile"
on public.seller_private_profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Sellers update own private profile" on public.seller_private_profiles;
create policy "Sellers update own private profile"
on public.seller_private_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Reports may be submitted without an account. Authenticated reporters may read their own reports.
drop policy if exists "Anyone can submit a report" on public.reports;
create policy "Anyone can submit a report"
on public.reports for insert
to anon, authenticated
with check (reporter_user_id is null or reporter_user_id = auth.uid());

drop policy if exists "Reporters read own reports" on public.reports;
create policy "Reporters read own reports"
on public.reports for select
to authenticated
using (reporter_user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports"
on public.reports for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Only administrators may read the audit trail.
drop policy if exists "Admins read listing audit" on public.listing_audit;
create policy "Admins read listing audit"
on public.listing_audit for select
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. Browser-role grants (RLS still controls each row)
-- ---------------------------------------------------------------------------
grant select, insert, update on public.seller_private_profiles to authenticated;
grant insert on public.reports to anon, authenticated;
grant select, update on public.reports to authenticated;
grant select on public.listing_audit to authenticated;

-- The retention_until fields are review dates, not an automatic deletion job.
-- Establish a documented retention/deletion process after Malaysian legal review.

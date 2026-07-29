-- Allow customers with email only (phone OR email required)

alter table public.customers
  alter column phone drop not null;

alter table public.customers
  drop constraint if exists customers_business_id_phone_key;

create unique index if not exists customers_business_phone_unique_idx
  on public.customers (business_id, phone)
  where phone is not null and phone <> '';

create unique index if not exists customers_business_email_unique_idx
  on public.customers (business_id, lower(email))
  where email is not null and email <> '';

alter table public.customers
  drop constraint if exists customers_phone_or_email_check;

alter table public.customers
  add constraint customers_phone_or_email_check
  check (
    (phone is not null and btrim(phone) <> '')
    or (email is not null and btrim(email) <> '')
  );

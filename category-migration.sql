-- DU2BAO2 category update: Bags, Cameras, Technology, Jewelry
-- Run once in Supabase Dashboard -> SQL Editor.

update public.listings set category = 'Bags' where category = 'Luxury Bags';
update public.listings set category = 'Jewelry' where category in ('Watches', 'Accessories');

alter table public.listings drop constraint if exists listings_category_check;

alter table public.listings
  add constraint listings_category_check
  check (category in ('Bags', 'Cameras', 'Technology', 'Jewelry')) not valid;

do $$
begin
  if not exists (
    select 1
    from public.listings
    where category not in ('Bags', 'Cameras', 'Technology', 'Jewelry')
  ) then
    alter table public.listings validate constraint listings_category_check;
  end if;
end;
$$;

-- If the constraint remains NOT VALID, an older listing still uses Fashion or
-- Miscellaneous. Edit that listing to one of the four new categories, then run:
-- alter table public.listings validate constraint listings_category_check;

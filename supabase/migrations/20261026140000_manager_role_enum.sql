-- Manager role. Kept in its own file: a new enum value cannot be used in the transaction that adds it.
alter type public.role_enum add value if not exists 'manager';

-- New files and folders are public (organization-wide) unless the owner marks them private.
ALTER TABLE public.drive_folders ALTER COLUMN visibility SET DEFAULT 'public';
ALTER TABLE public.drive_files ALTER COLUMN visibility SET DEFAULT 'public';

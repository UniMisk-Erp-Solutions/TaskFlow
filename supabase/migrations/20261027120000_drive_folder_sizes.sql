-- Total size (and file count) of every folder, including everything inside its subfolders, as the given viewer is allowed to see it:
-- a folder or file only counts when the viewer owns it or it is public (and, for subfolders, the whole path down to it is visible).
-- Called by the Edge Function (service role) when it lists a folder, so the Files page can show a folder's size.

create or replace function public.drive_folder_sizes(p_org uuid, p_viewer uuid)
returns table (folder_id uuid, total_bytes bigint, file_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select f.id as root, f.id as node
    from public.drive_folders f
    where f.org_id = p_org and (f.owner_id = p_viewer or f.visibility = 'public')
    union all
    select t.root, c.id
    from tree t
    join public.drive_folders c on c.parent_id = t.node and c.org_id = p_org
    where c.owner_id = p_viewer or c.visibility = 'public'
  )
  select t.root as folder_id,
         coalesce(sum(df.size_bytes), 0)::bigint as total_bytes,
         count(df.id)::bigint as file_count
  from tree t
  left join public.drive_files df
    on df.folder_id = t.node and df.org_id = p_org and (df.owner_id = p_viewer or df.visibility = 'public')
  group by t.root
$$;

revoke all on function public.drive_folder_sizes(uuid, uuid) from public, anon, authenticated;
grant execute on function public.drive_folder_sizes(uuid, uuid) to service_role;

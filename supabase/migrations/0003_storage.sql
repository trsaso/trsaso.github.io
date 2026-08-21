-- QuarryProof AI — evidence storage bucket + policies.
-- Paths are org-prefixed: <org_id>/reports/<report_id>/<file> or
-- <org_id>/actions/<action_id>/<file>. RLS keys off the first path segment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  15728640, -- 15 MB per file
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

create policy "org members read their org evidence"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "org members upload to their org folder"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and owner = auth.uid()
  );

create policy "uploaders can replace their own files"
  on storage.objects for update
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and owner = auth.uid()
  );

create policy "supervisors delete org evidence files"
  on storage.objects for delete
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_supervisor_or_admin()
  );


drop policy if exists "duo read" on storage.objects;
create policy "duo read own" on storage.objects for select
  to authenticated
  using (bucket_id = 'duo-media' and (storage.foldername(name))[1] = auth.uid()::text);

revoke execute on function public.handle_submission_xp() from anon, authenticated, public;

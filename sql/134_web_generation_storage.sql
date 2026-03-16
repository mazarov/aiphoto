-- Storage buckets for web generation
-- web-generation-uploads: user photos (input)
-- web-generation-results: generated images (output)

insert into storage.buckets (id, name, public)
values
  ('web-generation-uploads', 'web-generation-uploads', false),
  ('web-generation-results', 'web-generation-results', true)
on conflict (id) do update
set public = excluded.public;

-- Results bucket: public read (we serve result URLs to users)
update storage.buckets set public = true where id = 'web-generation-results';
update storage.buckets set public = false where id = 'web-generation-uploads';

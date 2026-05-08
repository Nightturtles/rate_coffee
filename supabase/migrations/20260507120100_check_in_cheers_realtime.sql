-- Enable Supabase Realtime broadcasts for cheers so the activity feed
-- can reflect new and removed reactions live.
alter publication supabase_realtime add table public.check_in_cheers;

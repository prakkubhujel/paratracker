import { createClient } from '@supabase/supabase-js';

// Populate these from your Supabase project settings (Connect dialog,
// or Settings > API Keys). In StackBlitz/Expo Snack, set them as
// environment variables rather than hardcoding.
//
// Uses the current publishable key (sb_publishable_...), not the
// legacy anon (JWT) key. Same low privilege, same RLS behavior — this
// is a naming/format change, not a permissions change. The legacy
// anon key still works today if that's what your project has, but
// Supabase has stated it will be deprecated by the end of 2026, so a
// new build in September 2026 should start on the current key rather
// than one with a removal date already scheduled.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

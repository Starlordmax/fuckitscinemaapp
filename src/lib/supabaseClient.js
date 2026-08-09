import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://begipvdiqchgqypwhhpq.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_47JG5SvaU11KHWClXkQcCA_jKgnFOBs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

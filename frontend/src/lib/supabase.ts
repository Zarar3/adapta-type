import { createClient } from '@supabase/supabase-js';

// Anon key is safe to expose — RLS blocks all direct table access.
// All writes go through the FastAPI backend using the service role key.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

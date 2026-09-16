import {createClient} from '@supabase/supabase-js';

// The publishable key is meant for browsers. Row Level Security protects the data.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ilqgjfzpyclswoowdlte.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_FD-HrHTBk9-Xw2KQFKHTtw_9Q-Ub808'
);

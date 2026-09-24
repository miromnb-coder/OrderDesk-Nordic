import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://avwplztfgixsgfnymgoe.supabase.co";
const supabasePublishableKey = "sb_publishable_MkxwcMYqbrVtp8XhhTU1gw_CUG5sPE5";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

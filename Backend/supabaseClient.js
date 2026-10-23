const { createClient } = require("@supabase/supabase-js");

// Shared admin client (service-role key). It must NEVER be used to sign users in:
// signInWithPassword() stores the user's session inside the client, and every later
// request (e.g. Storage uploads) would then run as that user instead of as the service
// role, failing with "new row violates row-level security policy".
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Throw-away client for user sign-in, so a login can never change the shared client's role.
supabase.createAuthClient = () =>
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

module.exports = supabase;

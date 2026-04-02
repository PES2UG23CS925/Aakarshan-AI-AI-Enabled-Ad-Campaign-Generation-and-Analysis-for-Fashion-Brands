const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env file"
  );
  console.error("   SUPABASE_URL:", supabaseUrl ? "✓ loaded" : "✗ missing");
  console.error(
    "   SUPABASE_SERVICE_ROLE_KEY:",
    supabaseKey ? "✓ loaded" : "✗ missing"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

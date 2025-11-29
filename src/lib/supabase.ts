import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client
 *
 * Environment variables required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anon/public key
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key"
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);


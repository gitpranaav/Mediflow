import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/src/lib/supabase/types";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createBrowserClient<Database, "public">(supabaseUrl, supabaseAnonKey);
}

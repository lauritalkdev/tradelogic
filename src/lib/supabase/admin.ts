import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value.trim();
}

export function createAdminClient() {
  const supabaseUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL"
  );

  const serviceRoleKey = getRequiredEnv(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
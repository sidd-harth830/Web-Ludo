import { createClient as createInsForgeClient } from '@insforge/sdk';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL || 'https://943byj73.ap-southeast.insforge.app';
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || 'ik_07fbca94276a8694b39c8359178a7002';

const sdkClient = createInsForgeClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey,
});

// We need the raw Supabase client to support advanced .channel() APIs requested by the user
const rawSupabase = createSupabaseClient(insforgeUrl, insforgeAnonKey);

// Create a hybrid client that supports both the SDK methods and raw Supabase .channel()
export const insforge = Object.assign(sdkClient, {
  channel: rawSupabase.channel.bind(rawSupabase),
  removeChannel: rawSupabase.removeChannel.bind(rawSupabase)
});

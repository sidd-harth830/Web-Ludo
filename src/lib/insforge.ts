import { createClient as createInsForgeClient } from '@insforge/sdk';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL || 'https://943byj73.ap-southeast.insforge.app';
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || 'anon_bcdb4af5b3c995dab2a7cf2a1db1d0955a4b55acc3bae88d28b33f978ed5ea80';

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

import { createClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL || 'https://943byj73.ap-southeast.insforge.app';
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || 'ik_07fbca94276a8694b39c8359178a7002';

export const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey,
});

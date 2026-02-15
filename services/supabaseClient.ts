
import { createClient } from '@supabase/supabase-js';

// Configurações fornecidas pelo usuário para o projeto Plataforma Pro
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wniqdwivddbxniybemhz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RTpfp7C0Wn6nnGQq7AYLOg_eRn5IFEe';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'PEP_auth_session'
  }
});


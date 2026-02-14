
import { createClient } from '@supabase/supabase-js';

// Configurações fornecidas pelo usuário para o projeto Plataforma Pro
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zvuxzrfbmmbhuhwaofrn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2dXh6cmZibW1iaHVod2FvZnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODkxNDEsImV4cCI6MjA4MjI2NTE0MX0.GpA8qLVeLF01x0baSALC1AmRTcKL90ALpxt35qKLVTQ';

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'PEP_auth_session'
  }
});


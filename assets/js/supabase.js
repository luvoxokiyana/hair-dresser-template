/**
 * Supabase client + minimal helpers. No business logic should ever live here
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';;
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY,
    {auth: { persistSession: true, autoRefreshToken: true} }
);

/**
 * Settings
 */

export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Auth
 */

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getSession()  {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/**
 * Guard an admin page. Redirect to admin login if no session.
 * Make sure to call at top of every single admin page's module script.
 */

export async function requireAuth() {
    const session = await getSession();

    if (!session) {
        window.location.replace('/admin/login.html');
        return null;
    }
    return session;
}
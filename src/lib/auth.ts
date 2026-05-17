import { supabase } from './supabase';

export interface AppSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function changeOwnPassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export async function fetchProfile(userId: string): Promise<AppSession | null> {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? '';
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    userId: data.id,
    email,
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    role: (data.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
  };
}

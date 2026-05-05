import { createClient } from './supabase/server';
import { redirect } from 'next/navigation';

export async function getCurrentEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single();
  return data as {
    id: string;
    login_id: string;
    name: string;
    role: 'admin' | 'staff';
    department: string[];
  } | null;
}

export async function requireEmployee() {
  const me = await getCurrentEmployee();
  if (!me) redirect('/login');
  return me;
}

export async function requireAdmin() {
  const me = await requireEmployee();
  if (me.role !== 'admin') redirect('/my-tasks');
  return me;
}

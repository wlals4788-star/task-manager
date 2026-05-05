import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import EmployeesClient from './EmployeesClient';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: true });
  return <EmployeesClient initial={data ?? []} />;
}

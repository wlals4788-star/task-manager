import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string; date?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, department')
    .order('department')
    .order('name');

  const empId = sp.emp ?? employees?.[0]?.id ?? null;
  const date = sp.date ?? new Date().toISOString().slice(0, 10);

  let instances: any[] = [];
  if (empId) {
    const from = new Date(date);
    from.setDate(from.getDate() - 6);
    const fromStr = from.toISOString().slice(0, 10);
    const { data } = await supabase
      .from('task_instances')
      .select('*')
      .eq('assignee_id', empId)
      .gte('due_date', fromStr)
      .lte('due_date', date)
      .order('due_date', { ascending: false })
      .order('kind');
    instances = data ?? [];
  }

  return (
    <ReviewClient
      employees={employees ?? []}
      selectedEmp={empId}
      date={date}
      instances={instances}
    />
  );
}

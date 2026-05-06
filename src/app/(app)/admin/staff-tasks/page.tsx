import { requireAdmin } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { today, tomorrow } from '@/lib/dates';
import StaffTasksClient from './StaffTasksClient';

export const dynamic = 'force-dynamic';

export default async function StaffTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, department')
    .order('name');

  const empId = sp.emp ?? employees?.[0]?.id ?? null;

  // 정기·상시 업무 자동 생성 (오늘/내일)
  const admin = createAdminClient();
  await admin.rpc('generate_daily_instances', { target_date: today() });
  await admin.rpc('generate_daily_instances', { target_date: tomorrow() });

  let instances: any[] = [];
  if (empId) {
    const { data } = await supabase
      .from('task_instances')
      .select('*')
      .eq('assignee_id', empId)
      .in('due_date', [today(), tomorrow()])
      .order('kind')
      .order('created_at');
    instances = data ?? [];
  }

  return (
    <StaffTasksClient
      employees={employees ?? []}
      selectedEmpId={empId}
      initial={instances}
      todayStr={today()}
      tomorrowStr={tomorrow()}
    />
  );
}

import { requireEmployee } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { today, tomorrow } from '@/lib/dates';
import MyTasksClient from './MyTasksClient';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const me = await requireEmployee();
  const supabase = await createClient();

  // 오늘/내일 정기·상시 인스턴스가 없으면 자동 생성
  const admin = createAdminClient();
  await admin.rpc('generate_daily_instances', { target_date: today() });
  await admin.rpc('generate_daily_instances', { target_date: tomorrow() });

  const { data: instances } = await supabase
    .from('task_instances')
    .select('*')
    .eq('assignee_id', me.id)
    .in('due_date', [today(), tomorrow()])
    .order('kind', { ascending: true })
    .order('created_at', { ascending: true });

  return (
    <MyTasksClient
      me={me}
      initial={instances ?? []}
      todayStr={today()}
      tomorrowStr={tomorrow()}
    />
  );
}

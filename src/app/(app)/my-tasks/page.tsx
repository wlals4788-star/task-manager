import { requireEmployee } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { today, tomorrow } from '@/lib/dates';
import MyTasksClient from './MyTasksClient';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const me = await requireEmployee();
  const supabase = await createClient();

  const todayStr = today();
  const tomorrowStr = tomorrow();

  // 정기·상시 인스턴스 자동 생성 (오늘 + 내일)
  const admin = createAdminClient();
  await admin.rpc('generate_daily_instances', { target_date: todayStr });
  await admin.rpc('generate_daily_instances', { target_date: tomorrowStr });

  // 정기 + 일회성: 오늘/내일 due_date
  const { data: regular } = await supabase
    .from('task_instances')
    .select('*')
    .eq('assignee_id', me.id)
    .in('kind', ['regular', 'one_time'])
    .in('due_date', [todayStr, tomorrowStr]);

  // 상시: 오늘 분만 (탭 무관 표시)
  const { data: standing } = await supabase
    .from('task_instances')
    .select('*')
    .eq('assignee_id', me.id)
    .eq('kind', 'standing')
    .eq('due_date', todayStr);

  // 수시(ad_hoc) + 외부추가(kind null): 미완료 전부, 날짜 무관
  const { data: adHoc } = await supabase
    .from('task_instances')
    .select('*')
    .eq('assignee_id', me.id)
    .or('kind.eq.ad_hoc,kind.is.null')
    .eq('status', 'todo');

  const instances = [...(regular ?? []), ...(standing ?? []), ...(adHoc ?? [])];

  // 본인이 담당자로 지정된 프로젝트 세부업무 (완료 제외)
  const { data: projectTasks } = await supabase
    .from('project_tasks')
    .select('*, projects(id, title, deadline)')
    .contains('assignee_ids', [me.id])
    .neq('status', 'done')
    .order('order_idx');

  return (
    <MyTasksClient
      me={me}
      initial={instances}
      todayStr={todayStr}
      tomorrowStr={tomorrowStr}
      projectTasks={(projectTasks ?? []) as any}
    />
  );
}

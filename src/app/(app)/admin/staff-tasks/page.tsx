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

  const todayStr = today();
  const tomorrowStr = tomorrow();

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, department')
    .order('name');

  const empId = sp.emp ?? employees?.[0]?.id ?? null;

  // 정기·상시 인스턴스 자동 생성 (병렬)
  const admin = createAdminClient();
  await Promise.all([
    admin.rpc('generate_daily_instances', { target_date: todayStr }),
    admin.rpc('generate_daily_instances', { target_date: tomorrowStr }),
  ]);

  let instances: any[] = [];
  let projectTasks: any[] = [];
  if (empId) {
    const [{ data: regular }, { data: standing }, { data: adHoc }, { data: pt }] = await Promise.all([
      supabase
        .from('task_instances')
        .select('*')
        .eq('assignee_id', empId)
        .in('kind', ['regular', 'one_time'])
        .in('due_date', [todayStr, tomorrowStr]),
      supabase
        .from('task_instances')
        .select('*')
        .eq('assignee_id', empId)
        .eq('kind', 'standing')
        .eq('due_date', todayStr),
      supabase
        .from('task_instances')
        .select('*')
        .eq('assignee_id', empId)
        .or('kind.eq.ad_hoc,kind.is.null')
        .eq('status', 'todo'),
      supabase
        .from('project_tasks')
        .select('*, projects(id, title, deadline)')
        .contains('assignee_ids', [empId])
        .neq('status', 'done')
        .order('order_idx'),
    ]);
    instances = [...(regular ?? []), ...(standing ?? []), ...(adHoc ?? [])];
    projectTasks = pt ?? [];
  }

  const [{ data: projects }, { data: linkedDepts }] = await Promise.all([
    supabase.from('projects').select('id, title').order('created_at', { ascending: false }),
    supabase.from('linked_departments').select('name').order('name'),
  ]);

  return (
    <StaffTasksClient
      employees={employees ?? []}
      selectedEmpId={empId}
      initial={instances}
      todayStr={todayStr}
      tomorrowStr={tomorrowStr}
      projectTasks={projectTasks}
      projects={projects ?? []}
      linkedDepts={(linkedDepts ?? []).map((d: any) => d.name)}
    />
  );
}

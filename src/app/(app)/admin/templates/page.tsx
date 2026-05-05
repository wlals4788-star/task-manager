import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import TemplatesClient from './TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [
    { data: templates },
    { data: employees },
    { data: projects },
    { data: projectMembers },
    { data: projectTasks },
    { data: linkedDepts },
  ] = await Promise.all([
    supabase
      .from('task_templates')
      .select('*')
      .order('department')
      .order('kind')
      .order('created_at'),
    supabase.from('employees').select('id, name, department').order('name'),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('project_members').select('project_id, employee_id'),
    supabase
      .from('project_tasks')
      .select('*')
      .order('order_idx')
      .order('created_at'),
    supabase.from('linked_departments').select('name').order('name'),
  ]);
  return (
    <TemplatesClient
      initial={templates ?? []}
      employees={employees ?? []}
      projects={projects ?? []}
      projectMembers={projectMembers ?? []}
      projectTasks={projectTasks ?? []}
      linkedDepts={(linkedDepts ?? []).map((d: any) => d.name)}
    />
  );
}

import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import TemplatesClient from './TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: templates }, { data: employees }] = await Promise.all([
    supabase
      .from('task_templates')
      .select('*')
      .order('department')
      .order('kind')
      .order('created_at'),
    supabase.from('employees').select('id, name, department').order('name'),
  ]);
  return <TemplatesClient initial={templates ?? []} employees={employees ?? []} />;
}

import { createClient } from '@/lib/supabase/server';
import RecruitsClient from './RecruitsClient';

export const dynamic = 'force-dynamic';

export default async function RecruitsPage() {
  const supabase = await createClient();

  const [{ data: recruits }, { data: employees }] = await Promise.all([
    supabase.from('recruits').select('*').order('created_at', { ascending: false }),
    supabase.from('employees').select('id, name, department, role').order('name'),
  ]);

  // 교육 분야 직원 (담당자 자동 지정용)
  const eduEmployees = (employees ?? []).filter((e: any) =>
    Array.isArray(e.department) && e.department.includes('교육')
  );

  return (
    <RecruitsClient
      initial={recruits ?? []}
      eduEmployeeIds={eduEmployees.map((e: any) => e.id)}
    />
  );
}

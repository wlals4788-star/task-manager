import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';

type Period = 'day' | 'week' | 'month';

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeFor(period: Period, anchor: string): { from: string; to: string } {
  const a = new Date(anchor + 'T00:00:00');
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const dow = a.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(a);
    mon.setDate(a.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: ymd(mon), to: ymd(sun) };
  }
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last) };
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string; date?: string; period?: Period }>;
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
  const period: Period = sp.period ?? 'day';

  const { from, to } = rangeFor(period, date);

  let instances: any[] = [];
  let standingTemplates: any[] = [];
  if (empId) {
    const [{ data: ins }, { data: st }] = await Promise.all([
      supabase
        .from('task_instances')
        .select('*')
        .eq('assignee_id', empId)
        .neq('kind', 'standing')
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date', { ascending: false })
        .order('department')
        .order('kind'),
      supabase
        .from('task_templates')
        .select('*')
        .eq('kind', 'standing')
        .eq('active', true)
        .contains('assignee_ids', [empId])
        .order('department')
        .order('created_at'),
    ]);
    instances = ins ?? [];
    standingTemplates = st ?? [];
  }

  return (
    <ReviewClient
      employees={employees ?? []}
      selectedEmp={empId}
      date={date}
      period={period}
      from={from}
      to={to}
      instances={instances}
      standingTemplates={standingTemplates}
    />
  );
}

import { createClient } from '@/lib/supabase/server';
import StudentsClient from './StudentsClient';

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from('recruits')
    .select(
      'id, name, phone, education_month, has_certificate, has_completion, has_uniform, uses_work_phone, has_business_card, created_at'
    )
    .order('created_at', { ascending: false });
  return <StudentsClient initial={students ?? []} />;
}

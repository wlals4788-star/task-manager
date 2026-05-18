import { createClient } from '@/lib/supabase/server';
import StudentsClient from './StudentsClient';

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });
  return <StudentsClient initial={students ?? []} />;
}

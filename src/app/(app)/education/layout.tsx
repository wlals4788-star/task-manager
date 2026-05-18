import { requireEmployee } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EducationTabs from './EducationTabs';

export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  const me = await requireEmployee();
  const canAccess = me.role === 'admin' || me.department.includes('교육');
  if (!canAccess) redirect('/my-tasks');

  return (
    <div className="space-y-4">
      <EducationTabs />
      {children}
    </div>
  );
}

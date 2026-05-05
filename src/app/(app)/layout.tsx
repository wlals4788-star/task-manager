import Nav from '@/components/Nav';
import { requireEmployee } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireEmployee();
  return (
    <>
      <Nav name={me.name} role={me.role} department={me.department} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}

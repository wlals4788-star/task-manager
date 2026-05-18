'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Nav({
  name,
  role,
  department,
}: {
  name: string;
  role: 'admin' | 'staff';
  department: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const canEdu = role === 'admin' || department.includes('교육');
  const items: { href: string; label: string; show: boolean }[] = [
    { href: '/my-tasks', label: '내 업무', show: true },
    { href: '/education/recruits', label: '교육관리', show: canEdu },
    { href: '/admin/staff-tasks', label: '담당자별 업무', show: role === 'admin' },
    { href: '/admin/templates', label: '업무 마스터', show: role === 'admin' },
    { href: '/admin/employees', label: '직원 관리', show: role === 'admin' },
    { href: '/admin/review', label: '검토', show: role === 'admin' },
  ];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href="/my-tasks" className="font-semibold mr-4">
            경영지원
          </Link>
          {items
            .filter((it) => it.show)
            .map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  prefetch={true}
                  onMouseEnter={() => router.prefetch(it.href)}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {name} · {department.join(', ')} · {role === 'admin' ? '관리자' : '직원'}
          </span>
          <button onClick={logout} className="text-slate-500 hover:text-slate-900">
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

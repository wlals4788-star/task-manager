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

  const items: { href: string; label: string; admin?: boolean }[] = [
    { href: '/my-tasks', label: '내 업무' },
    { href: '/admin/staff-tasks', label: '담당자별 업무', admin: true },
    { href: '/admin/templates', label: '업무 마스터', admin: true },
    { href: '/admin/employees', label: '직원 관리', admin: true },
    { href: '/admin/review', label: '검토', admin: true },
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
            .filter((it) => !it.admin || role === 'admin')
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/education/recruits', label: '인적사항 관리' },
  { href: '/education/students', label: '교육생 관리' },
];

export default function EducationTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-1.5 rounded-md text-sm ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

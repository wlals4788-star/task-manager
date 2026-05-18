'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  name: string;
  phone: string | null;
  education_month: string | null;
  has_certificate: boolean;
  has_completion: boolean;
  has_uniform: boolean;
  uses_work_phone: boolean;
  has_business_card: boolean;
  created_at: string;
};

type BoolField =
  | 'has_certificate'
  | 'has_completion'
  | 'has_uniform'
  | 'uses_work_phone'
  | 'has_business_card';

const BOOL_COLS: { key: BoolField; label: string }[] = [
  { key: 'has_certificate', label: '합격증' },
  { key: 'has_completion', label: '수료증' },
  { key: 'has_uniform', label: '근무복' },
  { key: 'uses_work_phone', label: '업무폰사용여부' },
  { key: 'has_business_card', label: '명함제작' },
];

export default function StudentsClient({ initial }: { initial: Student[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<Student[]>(initial);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = items.filter((s) => {
    if (filterMonth && s.education_month !== filterMonth) return false;
    if (q) {
      const hay = `${s.name} ${s.phone ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function toggleBool(s: Student, field: BoolField) {
    const next = !s[field];
    setItems((arr) => arr.map((x) => (x.id === s.id ? { ...x, [field]: next } : x)));
    const { error } = await supabase
      .from('recruits')
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) {
      alert('업데이트 실패: ' + error.message);
      setItems((arr) => arr.map((x) => (x.id === s.id ? { ...x, [field]: !next } : x)));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">교육생 관리</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="이름·연락처 검색"
            className="input text-sm w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="month"
            className="input text-sm"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
          {filterMonth && (
            <button
              onClick={() => setFilterMonth('')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              전체
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        교육생은 입사 예정자 관리에서 교육월을 지정한 사람들이 자동으로 표시됩니다. 추가/수정/삭제는 입사 예정자 관리에서 진행하세요.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2">이름</th>
              <th className="text-left px-3 py-2">연락처</th>
              <th className="text-left px-3 py-2">교육월</th>
              {BOOL_COLS.map((c) => (
                <th key={c.key} className="text-center px-3 py-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-slate-600">{s.phone ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {s.education_month ? formatMonth(s.education_month) : '-'}
                </td>
                {BOOL_COLS.map((c) => {
                  const on = s[c.key];
                  return (
                    <td key={c.key} className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleBool(s, c.key)}
                        className={`w-9 h-7 rounded-md text-sm font-semibold border transition ${
                          on
                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                            : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                        }`}
                      >
                        {on ? 'O' : 'X'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={BOOL_COLS.length + 3} className="px-3 py-8 text-center text-slate-500">
                  {filterMonth
                    ? `${formatMonth(filterMonth)}에 해당하는 교육생이 없습니다.`
                    : '등록된 교육생이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  return `${y}년 ${parseInt(m, 10)}월`;
}

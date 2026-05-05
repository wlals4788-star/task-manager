'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { KIND_LABEL, type Kind } from '@/lib/constants';

type Employee = { id: string; name: string; department: string };
type Instance = {
  id: string;
  title: string;
  kind: string | null;
  department: string | null;
  due_date: string;
  status: 'todo' | 'done';
  source: string;
  linked_dept: string | null;
  memo: string | null;
};

export default function ReviewClient({
  employees,
  selectedEmp,
  date,
  instances,
}: {
  employees: Employee[];
  selectedEmp: string | null;
  date: string;
  instances: Instance[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(params: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(params).forEach(([k, v]) => next.set(k, v));
    router.push(`/admin/review?${next.toString()}`);
  }

  // group by date
  const byDate: Record<string, Instance[]> = {};
  for (const i of instances) {
    (byDate[i.due_date] ??= []).push(i);
  }
  const dates = Object.keys(byDate).sort().reverse();

  const totalToday = instances.filter((i) => i.due_date === date).length;
  const doneToday = instances.filter((i) => i.due_date === date && i.status === 'done').length;

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4">
      <aside className="space-y-1 max-h-[80vh] overflow-auto">
        <h2 className="text-xs text-slate-500 px-2 mb-1">직원</h2>
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => update({ emp: e.id })}
            className={`w-full text-left px-3 py-2 text-sm rounded-md ${
              selectedEmp === e.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
            }`}
          >
            <div className="font-medium">{e.name}</div>
            <div className={`text-xs ${selectedEmp === e.id ? 'text-slate-300' : 'text-slate-500'}`}>
              {e.department}
            </div>
          </button>
        ))}
      </aside>

      <section className="space-y-3">
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
          <div>
            <div className="text-sm text-slate-500">기준일자</div>
            <input
              type="date"
              value={date}
              onChange={(e) => update({ date: e.target.value })}
              className="text-sm border border-slate-200 rounded px-2 py-1"
            />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">기준일 진행률</div>
            <div className="text-lg font-semibold">
              {doneToday}/{totalToday}{' '}
              {totalToday > 0 && (
                <span className="text-sm text-slate-500">
                  ({Math.round((doneToday / totalToday) * 100)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {selectedEmp == null && (
          <div className="text-sm text-slate-500">왼쪽에서 직원을 선택하세요.</div>
        )}

        {dates.map((d) => {
          const items = byDate[d];
          const done = items.filter((i) => i.status === 'done').length;
          return (
            <div key={d} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-sm">
                <span className="font-medium">{d}</span>
                <span className="text-xs text-slate-500">
                  {done}/{items.length}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((i) => (
                  <div key={i.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        i.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span className={i.status === 'done' ? 'line-through text-slate-400' : ''}>
                      {i.title}
                    </span>
                    {i.kind && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">
                        {KIND_LABEL[i.kind as Kind] ?? i.kind}
                      </span>
                    )}
                    {i.department && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                        {i.department}
                      </span>
                    )}
                    {i.source === 'external' && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                        외부
                      </span>
                    )}
                    {i.linked_dept && (
                      <span className="text-xs text-slate-500">
                        연계: {i.linked_dept}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {selectedEmp != null && dates.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8 bg-white border border-slate-200 rounded-lg">
            기준일 기준 최근 7일 내역이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}

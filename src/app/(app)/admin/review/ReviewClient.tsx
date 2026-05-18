'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEPARTMENTS } from '@/lib/constants';
import AssignTaskDialog from '@/components/AssignTaskDialog';

type Period = 'day' | 'week' | 'month';
type Employee = { id: string; name: string; department: string[] };
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
type StandingTemplate = {
  id: string;
  title: string;
  department: string;
  linked_dept: string | null;
  memo: string | null;
};

const KIND_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  regular:  { label: '정기', bg: 'bg-violet-50',  text: 'text-violet-700' },
  one_time: { label: '일회성', bg: 'bg-violet-50', text: 'text-violet-700' },
  ad_hoc:   { label: '수시', bg: 'bg-amber-50',   text: 'text-amber-700' },
};

const DEPT_DOT_COLOR: Record<string, string> = {
  '인사관리': 'bg-blue-500',
  '총무': 'bg-emerald-500',
  '세무회계': 'bg-orange-500',
  '정산': 'bg-yellow-500',
  '교육': 'bg-purple-500',
};

type ProjectRef = { id: string; title: string };

export default function ReviewClient({
  employees,
  selectedEmp,
  date,
  period,
  from,
  to,
  instances,
  standingTemplates,
  projects,
  linkedDepts,
}: {
  employees: Employee[];
  selectedEmp: string | null;
  date: string;
  period: Period;
  from: string;
  to: string;
  instances: Instance[];
  standingTemplates: StandingTemplate[];
  projects: ProjectRef[];
  linkedDepts: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);

  function update(params: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(params).forEach(([k, v]) => next.set(k, v));
    router.push(`/admin/review?${next.toString()}`);
  }

  // 일자 → 분야 → 인스턴스 그룹핑
  const byDateThenDept: Record<string, Record<string, Instance[]>> = {};
  for (const i of instances) {
    const dept = i.department ?? '기타';
    ((byDateThenDept[i.due_date] ??= {})[dept] ??= []).push(i);
  }
  const dates = Object.keys(byDateThenDept).sort().reverse();

  const totalInRange = instances.length;
  const doneInRange = instances.filter((i) => i.status === 'done').length;
  const selectedEmployee = employees.find((e) => e.id === selectedEmp) ?? null;

  // 상시 분야별
  const standingByDept: Record<string, StandingTemplate[]> = {};
  for (const s of standingTemplates) {
    (standingByDept[s.department] ??= []).push(s);
  }
  const standingDepts = DEPARTMENTS.filter((d) => standingByDept[d]?.length);

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4">
      <aside className="space-y-1 max-h-[85vh] overflow-auto">
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
              {e.department.join(', ')}
            </div>
          </button>
        ))}
      </aside>

      <section className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 bg-slate-50 rounded-md p-1 border border-slate-200">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => update({ period: p })}
                  className={`px-3 py-1 text-sm rounded ${
                    period === p ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {p === 'day' ? '일간' : p === 'week' ? '주간' : '월간'}
                </button>
              ))}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">완료/전체</div>
              <div className="text-lg font-semibold">
                {doneInRange}/{totalInRange}{' '}
                {totalInRange > 0 && (
                  <span className="text-sm text-slate-500">
                    ({Math.round((doneInRange / totalInRange) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">기준일자</span>
              <input
                type="date"
                value={date}
                onChange={(e) => update({ date: e.target.value })}
                className="text-sm border border-slate-200 rounded px-2 py-1"
              />
              <span className="text-xs text-slate-500">
                ({from === to ? from : `${from} ~ ${to}`})
              </span>
            </div>
            {selectedEmployee && (
              <button
                onClick={() => setShowAdd(true)}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
              >
                + {selectedEmployee.name}에게 업무 부여
              </button>
            )}
          </div>
        </div>

        {selectedEmp == null && (
          <div className="text-sm text-slate-500 text-center py-8 bg-white border border-slate-200 rounded-lg">
            왼쪽에서 직원을 선택하세요.
          </div>
        )}

        {selectedEmp != null && (
          <>
            {/* 상시업무 최상단 고정 */}
            {standingDepts.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold border-b border-emerald-100">
                  상시업무 (고정)
                </div>
                <div className="divide-y divide-slate-100">
                  {standingDepts.map((dept) => (
                    <div key={dept} className="px-4 py-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${DEPT_DOT_COLOR[dept] ?? 'bg-slate-400'}`} />
                        <span className="font-medium">{dept}</span>
                      </div>
                      <ul className="space-y-1 ml-4">
                        {standingByDept[dept].map((s) => (
                          <li key={s.id} className="text-sm flex items-center gap-2">
                            <span>{s.title}</span>
                            {s.linked_dept && (
                              <span className="text-xs text-slate-500">연계: {s.linked_dept}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 일자별 → 분야별 */}
            {dates.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-8 bg-white border border-slate-200 rounded-lg">
                기간 내 업무가 없습니다.
              </div>
            )}

            {dates.map((d) => {
              const deptMap = byDateThenDept[d];
              const dayDepts = DEPARTMENTS.filter((x) => deptMap[x]?.length);
              const otherDepts = Object.keys(deptMap).filter((x) => !DEPARTMENTS.includes(x as any));
              const all = [...dayDepts, ...otherDepts];
              const dayTotal = Object.values(deptMap).reduce((a, b) => a + b.length, 0);
              const dayDone = Object.values(deptMap)
                .flat()
                .filter((i) => i.status === 'done').length;
              return (
                <div key={d} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-sm border-b border-slate-200">
                    <span className="font-medium">{d}</span>
                    <span className="text-xs text-slate-500">
                      완료 {dayDone}/{dayTotal}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {all.map((dept) => (
                      <div key={dept} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${DEPT_DOT_COLOR[dept] ?? 'bg-slate-400'}`} />
                          <span className="font-medium">{dept}</span>
                        </div>
                        <ul className="space-y-1 ml-4">
                          {deptMap[dept].map((i) => {
                            const k = KIND_BADGE[i.kind ?? 'ad_hoc'] ?? KIND_BADGE.ad_hoc;
                            return (
                              <li key={i.id} className="text-sm flex items-center gap-2 flex-wrap">
                                <span className={i.status === 'done' ? 'line-through text-slate-400' : ''}>
                                  {i.title}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${k.bg} ${k.text}`}>
                                  {k.label}
                                </span>
                                {i.source === 'external' && (
                                  <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                                    외부
                                  </span>
                                )}
                                {i.linked_dept && (
                                  <span className="text-xs text-slate-500">연계: {i.linked_dept}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {showAdd && selectedEmployee && (
        <AssignTaskDialog
          assignee={selectedEmployee}
          defaultDate={date}
          projects={projects}
          linkedDepts={linkedDepts}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

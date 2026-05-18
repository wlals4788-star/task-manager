'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, KIND_LABEL, type Kind } from '@/lib/constants';

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

const KIND_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  regular:  { label: '정기', bg: 'bg-violet-50',  text: 'text-violet-700' },
  one_time: { label: '일회성', bg: 'bg-violet-50', text: 'text-violet-700' },
  ad_hoc:   { label: '수시', bg: 'bg-amber-50',   text: 'text-amber-700' },
};

export default function ReviewClient({
  employees,
  selectedEmp,
  date,
  period,
  from,
  to,
  instances,
}: {
  employees: Employee[];
  selectedEmp: string | null;
  date: string;
  period: Period;
  from: string;
  to: string;
  instances: Instance[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);

  function update(params: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(params).forEach(([k, v]) => next.set(k, v));
    router.push(`/admin/review?${next.toString()}`);
  }

  // 완료된 업무만 필터
  const completed = instances.filter((i) => i.status === 'done');
  const byDate: Record<string, Instance[]> = {};
  for (const i of completed) {
    (byDate[i.due_date] ??= []).push(i);
  }
  const dates = Object.keys(byDate).sort().reverse();

  const totalInRange = instances.length;
  const doneInRange = completed.length;
  const selectedEmployee = employees.find((e) => e.id === selectedEmp) ?? null;

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
          {/* 기간 탭 */}
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

          {/* 기준일자 + 표시 범위 */}
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
                + {selectedEmployee.name}에게 수시업무 부여
              </button>
            )}
          </div>
        </div>

        {selectedEmp == null && (
          <div className="text-sm text-slate-500 text-center py-8 bg-white border border-slate-200 rounded-lg">
            왼쪽에서 직원을 선택하세요.
          </div>
        )}

        {selectedEmp != null && completed.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8 bg-white border border-slate-200 rounded-lg">
            기간 내 완료된 업무가 없습니다. (상시업무 제외)
          </div>
        )}

        {dates.map((d) => {
          const items = byDate[d];
          return (
            <div key={d} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-sm">
                <span className="font-medium">{d}</span>
                <span className="text-xs text-slate-500">{items.length}건</span>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((i) => {
                  const k = KIND_BADGE[i.kind ?? 'ad_hoc'] ?? KIND_BADGE.ad_hoc;
                  return (
                    <div key={i.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{i.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${k.bg} ${k.text}`}>
                        {k.label}
                      </span>
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
                        <span className="text-xs text-slate-500">연계: {i.linked_dept}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {showAdd && selectedEmployee && (
        <AssignDialog
          assignee={selectedEmployee}
          defaultDate={date}
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

function AssignDialog({
  assignee,
  defaultDate,
  onClose,
  onDone,
}: {
  assignee: Employee;
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(assignee.department[0] ?? '인사관리');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [linkedDept, setLinkedDept] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('task_instances').insert({
      assignee_id: assignee.id,
      title: title.trim(),
      department,
      kind: 'ad_hoc',
      due_date: dueDate,
      source: 'external',
      linked_dept: linkedDept || null,
      memo: memo || null,
      status: 'todo',
    });
    setBusy(false);
    if (error) {
      alert('추가 실패: ' + error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{assignee.name}에게 수시업무 부여</h2>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <Field label="업무명">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="분야">
          <select
            className="input bg-white"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="마감일">
          <input
            type="date"
            className="input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="연계부서">
          <input
            className="input"
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
          />
        </Field>
        <Field label="메모">
          <textarea
            className="input"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
          >
            {busy ? '추가 중…' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

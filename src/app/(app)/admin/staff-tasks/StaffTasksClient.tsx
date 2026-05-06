'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, KIND_LABEL, type Kind } from '@/lib/constants';

type Employee = { id: string; name: string; department: string[] };

type Instance = {
  id: string;
  template_id: string | null;
  assignee_id: string;
  title: string;
  department: string | null;
  kind: string | null;
  due_date: string;
  status: 'todo' | 'done';
  source: 'template' | 'external';
  linked_dept: string | null;
  memo: string | null;
  created_at?: string | null;
};

export default function StaffTasksClient({
  employees,
  selectedEmpId,
  initial,
  todayStr,
  tomorrowStr,
}: {
  employees: Employee[];
  selectedEmpId: string | null;
  initial: Instance[];
  todayStr: string;
  tomorrowStr: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today');
  const [items, setItems] = useState<Instance[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Instance | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  function changeEmp(id: string) {
    const next = new URLSearchParams(sp);
    next.set('emp', id);
    router.push(`/admin/staff-tasks?${next.toString()}`);
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId) ?? null;

  const filtered = items.filter(
    (i) => i.due_date === (tab === 'today' ? todayStr : tomorrowStr)
  );
  const doneCount = filtered.filter((i) => i.status === 'done').length;

  async function toggle(inst: Instance) {
    const newStatus = inst.status === 'done' ? 'todo' : 'done';
    setItems((arr) =>
      arr.map((x) => (x.id === inst.id ? { ...x, status: newStatus } : x))
    );
    await supabase
      .from('task_instances')
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', inst.id);
  }

  async function remove(inst: Instance) {
    if (inst.source !== 'external') {
      alert('외부(수시) 업무만 삭제할 수 있습니다.');
      return;
    }
    if (!confirm('삭제하시겠습니까?')) return;
    setItems((arr) => arr.filter((x) => x.id !== inst.id));
    await supabase.from('task_instances').delete().eq('id', inst.id);
  }

  async function saveMemo(inst: Instance, memo: string) {
    const { error } = await supabase
      .from('task_instances')
      .update({ memo: memo || null })
      .eq('id', inst.id);
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    setItems((arr) => arr.map((x) => (x.id === inst.id ? { ...x, memo: memo || null } : x)));
    setDetail(null);
  }

  async function addAdHoc(form: {
    title: string;
    department: string;
    due_date: string;
    linked_dept: string;
    memo: string;
  }) {
    if (!selectedEmpId) return;
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        assignee_id: selectedEmpId,
        title: form.title,
        department: form.department,
        kind: 'ad_hoc',
        due_date: form.due_date,
        source: 'external',
        linked_dept: form.linked_dept || null,
        memo: form.memo || null,
        status: 'todo',
      })
      .select()
      .single();
    if (error) {
      alert('추가 실패: ' + error.message);
      return;
    }
    setItems((arr) => [...arr, data as Instance]);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">담당자</label>
          <select
            value={selectedEmpId ?? ''}
            onChange={(e) => changeEmp(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white min-w-[180px]"
          >
            {employees.length === 0 && <option value="">직원 없음</option>}
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.department.join(', ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
            {(['today', 'tomorrow'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1 rounded-md text-sm ${
                  tab === t ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {t === 'today' ? '오늘' : '내일'}
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-500">
            완료 {doneCount}/{filtered.length}
          </span>
        </div>
      </div>

      {!selectedEmp && (
        <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-8 text-center">
          담당자를 선택하세요.
        </div>
      )}

      {selectedEmp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Column
            title="상시업무"
            items={filtered.filter((i) => i.kind === 'standing')}
            onItemClick={setDetail}
            onToggle={toggle}
            onRemove={remove}
            todayStr={todayStr}
          />
          <Column
            title="정기업무"
            items={filtered.filter((i) => i.kind === 'regular' || i.kind === 'one_time')}
            onItemClick={setDetail}
            onToggle={toggle}
            onRemove={remove}
            todayStr={todayStr}
          />
          <Column
            title="수시업무"
            items={filtered.filter((i) => i.kind === 'ad_hoc' || !i.kind)}
            onItemClick={setDetail}
            onToggle={toggle}
            onRemove={remove}
            todayStr={todayStr}
            addButton={
              <button
                onClick={() => setShowAdd(true)}
                className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs"
              >
                + 부여
              </button>
            }
          />
        </div>
      )}

      {showAdd && selectedEmp && (
        <AddDialog
          assignee={selectedEmp}
          defaultDept={selectedEmp.department[0] ?? '인사관리'}
          defaultDate={tab === 'today' ? todayStr : tomorrowStr}
          onClose={() => setShowAdd(false)}
          onSubmit={addAdHoc}
        />
      )}

      {detail && (
        <DetailDialog
          inst={detail}
          onClose={() => setDetail(null)}
          onSave={(memo) => saveMemo(detail, memo)}
          onToggleStatus={() => toggle(detail)}
        />
      )}
    </div>
  );
}

function Column({
  title,
  items,
  onItemClick,
  onToggle,
  onRemove,
  addButton,
  todayStr,
}: {
  title: string;
  items: Instance[];
  onItemClick: (i: Instance) => void;
  onToggle: (i: Instance) => void;
  onRemove: (i: Instance) => void;
  addButton?: React.ReactNode;
  todayStr: string;
}) {
  const done = items.filter((i) => i.status === 'done').length;
  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-slate-500">
            {done}/{items.length}
          </span>
        </div>
        {addButton}
      </div>
      <div className="divide-y divide-slate-100 flex-1">
        {items.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">업무 없음</div>
        )}
        {items.map((inst) => {
          const isFreshOneTime =
            inst.kind === 'one_time' &&
            inst.created_at?.slice(0, 10) === todayStr;
          return (
          <div
            key={inst.id}
            onClick={() => onItemClick(inst)}
            className="p-3 flex items-start gap-2 cursor-pointer hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={inst.status === 'done'}
              onChange={() => onToggle(inst)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-sm ${
                    inst.status === 'done'
                      ? 'line-through text-slate-400 font-medium'
                      : isFreshOneTime
                        ? 'text-blue-600 font-bold'
                        : 'font-medium'
                  }`}
                >
                  {inst.title}
                </span>
                {inst.department && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                    {inst.department}
                  </span>
                )}
                {inst.source === 'external' && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                    외부
                  </span>
                )}
              </div>
              {inst.linked_dept && (
                <div className="text-xs text-slate-500 mt-0.5">연계: {inst.linked_dept}</div>
              )}
              {inst.memo && (
                <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-2">
                  {inst.memo}
                </p>
              )}
            </div>
            {inst.source === 'external' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(inst);
                }}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function AddDialog({
  assignee,
  defaultDept,
  defaultDate,
  onClose,
  onSubmit,
}: {
  assignee: Employee;
  defaultDept: string;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (f: {
    title: string;
    department: string;
    due_date: string;
    linked_dept: string;
    memo: string;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(defaultDept);
  const [dueDate, setDueDate] = useState(defaultDate);
  const [linkedDept, setLinkedDept] = useState('');
  const [memo, setMemo] = useState('');

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
        <h2 className="font-semibold">{assignee.name}에게 수시업무 부여</h2>
        <Field label="업무명">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            autoFocus
          />
        </Field>
        <Field label="분야">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input bg-white"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="마감일">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="연계부서">
          <input
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="메모">
          <textarea
            value={memo}
            rows={2}
            onChange={(e) => setMemo(e.target.value)}
            className="input"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
            취소
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return;
              onSubmit({
                title: title.trim(),
                department,
                due_date: dueDate,
                linked_dept: linkedDept,
                memo,
              });
            }}
            className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailDialog({
  inst,
  onClose,
  onSave,
  onToggleStatus,
}: {
  inst: Instance;
  onClose: () => void;
  onSave: (memo: string) => Promise<void>;
  onToggleStatus: () => void;
}) {
  const [memo, setMemo] = useState(inst.memo ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-base">{inst.title}</h2>
          <button onClick={onClose} className="text-slate-400 shrink-0">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {inst.kind && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">
              {KIND_LABEL[inst.kind as Kind] ?? inst.kind}
            </span>
          )}
          {inst.department && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
              {inst.department}
            </span>
          )}
          {inst.source === 'external' && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
              외부
            </span>
          )}
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              inst.status === 'done'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {inst.status === 'done' ? '완료' : '미완료'}
          </span>
        </div>

        <dl className="text-xs text-slate-600 space-y-1">
          <div className="flex gap-2">
            <dt className="w-16 text-slate-400 shrink-0">마감일</dt>
            <dd>{inst.due_date}</dd>
          </div>
          {inst.linked_dept && (
            <div className="flex gap-2">
              <dt className="w-16 text-slate-400 shrink-0">연계부서</dt>
              <dd>{inst.linked_dept}</dd>
            </div>
          )}
        </dl>

        <div>
          <label className="block text-xs text-slate-600 mb-1">업무 메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={onToggleStatus}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {inst.status === 'done' ? '완료 취소' : '완료 처리'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
              취소
            </button>
            <button
              onClick={async () => {
                setBusy(true);
                await onSave(memo);
                setBusy(false);
              }}
              disabled={busy}
              className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
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

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, KIND_LABEL, type Kind } from '@/lib/constants';

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
};

type Me = { id: string; name: string; department: string };

export default function MyTasksClient({
  me,
  initial,
  todayStr,
  tomorrowStr,
}: {
  me: Me;
  initial: Instance[];
  todayStr: string;
  tomorrowStr: string;
}) {
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today');
  const [items, setItems] = useState<Instance[]>(initial);
  const [showAdd, setShowAdd] = useState(false);

  const supabase = createClient();
  const filtered = items.filter(
    (i) => i.due_date === (tab === 'today' ? todayStr : tomorrowStr)
  );

  async function toggle(inst: Instance) {
    const newStatus = inst.status === 'done' ? 'todo' : 'done';
    setItems((arr) =>
      arr.map((x) =>
        x.id === inst.id
          ? { ...x, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null as any }
          : x
      )
    );
    await supabase
      .from('task_instances')
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', inst.id);
  }

  async function addExternal(form: {
    title: string;
    department: string;
    due_date: string;
    linked_dept: string;
    memo: string;
  }) {
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        assignee_id: me.id,
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

  async function remove(inst: Instance) {
    if (inst.source !== 'external') {
      alert('외부 추가 업무만 삭제할 수 있습니다. (정기/상시 업무는 마스터에서 관리)');
      return;
    }
    if (!confirm('삭제하시겠습니까?')) return;
    setItems((arr) => arr.filter((x) => x.id !== inst.id));
    await supabase.from('task_instances').delete().eq('id', inst.id);
  }

  const doneCount = filtered.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
          {(['today', 'tomorrow'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm ${
                tab === t ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {t === 'today' ? '오늘' : '내일'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            완료 {doneCount}/{filtered.length}
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
          >
            + 외부 업무 추가
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">업무가 없습니다.</div>
        )}
        {filtered.map((inst) => (
          <div key={inst.id} className="p-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={inst.status === 'done'}
              onChange={() => toggle(inst)}
              className="mt-1 h-4 w-4"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    inst.status === 'done' ? 'line-through text-slate-400' : ''
                  }`}
                >
                  {inst.title}
                </span>
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
                {inst.linked_dept && (
                  <span className="text-xs text-slate-500">
                    연계: {inst.linked_dept}
                  </span>
                )}
              </div>
              {inst.memo && (
                <p className="text-xs text-slate-500 mt-1">{inst.memo}</p>
              )}
            </div>
            {inst.source === 'external' && (
              <button
                onClick={() => remove(inst)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                삭제
              </button>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <AddExternalDialog
          defaultDept={me.department}
          defaultDate={tab === 'today' ? todayStr : tomorrowStr}
          onClose={() => setShowAdd(false)}
          onSubmit={addExternal}
        />
      )}
    </div>
  );
}

function AddExternalDialog({
  defaultDept,
  defaultDate,
  onClose,
  onSubmit,
}: {
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
        <h2 className="font-semibold">외부 업무 추가</h2>
        <Input label="업무명" value={title} onChange={setTitle} required />
        <Select
          label="분야"
          value={department}
          onChange={setDepartment}
          options={DEPARTMENTS as readonly string[]}
        />
        <Input label="마감일" type="date" value={dueDate} onChange={setDueDate} />
        <Input label="연계부서" value={linkedDept} onChange={setLinkedDept} />
        <Input label="메모" value={memo} onChange={setMemo} />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
            취소
          </button>
          <button
            onClick={() => {
              if (!title.trim()) return;
              onSubmit({ title: title.trim(), department, due_date: dueDate, linked_dept: linkedDept, memo });
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

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

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
  created_at?: string | null;
};

type Me = { id: string; name: string; department: string[] };

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
  const [detail, setDetail] = useState<Instance | null>(null);

  const supabase = createClient();
  const activeDate = tab === 'today' ? todayStr : tomorrowStr;
  // 컬럼별 필터: 정기는 탭 날짜, 상시·수시는 항상 표시
  const standingItems = items.filter((i) => i.kind === 'standing');
  const regularItems = items.filter(
    (i) => (i.kind === 'regular' || i.kind === 'one_time') && i.due_date === activeDate
  );
  const adHocItems = items.filter((i) => i.kind === 'ad_hoc' || !i.kind);
  const visible = [...standingItems, ...regularItems, ...adHocItems];

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

  const doneCount = visible.filter((i) => i.status === 'done').length;

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
            완료 {doneCount}/{visible.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column
          title="상시업무"
          items={standingItems}
          onItemClick={setDetail}
          onToggle={toggle}
          onRemove={remove}
          todayStr={todayStr}
          color="emerald"
        />
        <Column
          title="수시업무"
          items={adHocItems}
          onItemClick={setDetail}
          onToggle={toggle}
          onRemove={remove}
          todayStr={todayStr}
          color="amber"
          addButton={
            <button
              onClick={() => setShowAdd(true)}
              className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs"
            >
              + 추가
            </button>
          }
        />
        <Column
          title="정기업무"
          items={regularItems}
          onItemClick={setDetail}
          onToggle={toggle}
          onRemove={remove}
          todayStr={todayStr}
          color="violet"
        />
      </div>

      {showAdd && (
        <AddExternalDialog
          defaultDept={me.department[0] ?? '인사관리'}
          defaultDate={tab === 'today' ? todayStr : tomorrowStr}
          onClose={() => setShowAdd(false)}
          onSubmit={addExternal}
        />
      )}

      {detail && (
        <DetailDialog
          inst={detail}
          onClose={() => setDetail(null)}
          onSave={async (memo) => {
            const { error } = await supabase
              .from('task_instances')
              .update({ memo: memo || null })
              .eq('id', detail.id);
            if (error) {
              alert('저장 실패: ' + error.message);
              return;
            }
            setItems((arr) =>
              arr.map((x) => (x.id === detail.id ? { ...x, memo: memo || null } : x))
            );
            setDetail(null);
          }}
          onToggleStatus={() => toggle(detail)}
        />
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; leftBar: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', leftBar: 'border-l-4 border-l-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', leftBar: 'border-l-4 border-l-amber-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', leftBar: 'border-l-4 border-l-violet-500' },
};

function Column({
  title,
  items,
  onItemClick,
  onToggle,
  onRemove,
  addButton,
  todayStr,
  color,
}: {
  title: string;
  items: Instance[];
  onItemClick: (i: Instance) => void;
  onToggle: (i: Instance) => void;
  onRemove: (i: Instance) => void;
  addButton?: React.ReactNode;
  todayStr: string;
  color: 'emerald' | 'amber' | 'violet';
}) {
  const c = COLOR_MAP[color];
  const done = items.filter((i) => i.status === 'done').length;
  return (
    <div className={`bg-white border ${c.border} ${c.leftBar} rounded-lg flex flex-col`}>
      <div className={`px-3 py-2 flex items-center justify-between border-b ${c.border} ${c.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${c.text}`}>{title}</span>
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
            placeholder="이 업무에 대한 메모를 자유롭게 작성하세요."
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
        <h2 className="font-semibold">수시업무 추가</h2>
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

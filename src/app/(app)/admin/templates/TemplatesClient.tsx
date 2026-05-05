'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DEPARTMENTS,
  FREQUENCY_LABEL,
  KIND_LABEL,
  WEEKDAYS,
  type Frequency,
  type Kind,
} from '@/lib/constants';

type Template = {
  id: string;
  department: string;
  title: string;
  kind: Kind;
  frequency: Frequency | null;
  frequency_detail: any;
  assignee_id: string | null;
  linked_dept: string | null;
  memo: string | null;
  active: boolean;
};

type Employee = { id: string; name: string; department: string[] };

export default function TemplatesClient({
  initial,
  employees,
}: {
  initial: Template[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const supabase = createClient();

  const filtered = initial.filter(
    (t) => t.department === department && (kindFilter === 'all' || t.kind === kindFilter)
  );

  async function toggleActive(t: Template) {
    await supabase.from('task_templates').update({ active: !t.active }).eq('id', t.id);
    router.refresh();
  }
  async function remove(t: Template) {
    if (!confirm('삭제하시겠습니까? (해당 템플릿으로 이미 생성된 업무 인스턴스는 유지됩니다)'))
      return;
    await supabase.from('task_templates').delete().eq('id', t.id);
    router.refresh();
  }

  const empById = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  return (
    <div className="grid grid-cols-[180px_1fr] gap-4">
      <aside className="space-y-1">
        <h2 className="text-xs text-slate-500 px-2 mb-1">분야</h2>
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => setDepartment(d)}
            className={`w-full text-left px-3 py-2 text-sm rounded-md ${
              department === d ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
            }`}
          >
            {d}
          </button>
        ))}
      </aside>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-md p-1">
            {(['all', 'regular', 'ad_hoc', 'standing'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`px-3 py-1 text-sm rounded ${
                  kindFilter === k ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {k === 'all' ? '전체' : KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setEditing('new')}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
          >
            + 세부업무 추가
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">제목</th>
                <th className="text-left px-3 py-2">구분</th>
                <th className="text-left px-3 py-2">주기</th>
                <th className="text-left px-3 py-2">담당자</th>
                <th className="text-left px-3 py-2">연계부서</th>
                <th className="text-left px-3 py-2">활성</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className={t.active ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 font-medium">{t.title}</td>
                  <td className="px-3 py-2">{KIND_LABEL[t.kind]}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {t.kind === 'regular' && t.frequency
                      ? `${FREQUENCY_LABEL[t.frequency]}${describeDetail(t.frequency, t.frequency_detail)}`
                      : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {t.assignee_id ? empById[t.assignee_id] ?? '(삭제됨)' : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.linked_dept ?? '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`text-xs px-2 py-0.5 rounded ${
                        t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.active ? '활성' : '중지'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => setEditing(t)}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    등록된 업무가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EditDialog
          initial={editing === 'new' ? { department } : editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function describeDetail(freq: Frequency, detail: any): string {
  if (!detail) return '';
  if (freq === 'weekly' && detail.weekday != null) {
    return ` (${WEEKDAYS[detail.weekday]}요일)`;
  }
  if (freq === 'monthly' && detail.day) return ` (${detail.day}일)`;
  if (freq === 'quarterly' && detail.day) return ` (분기 첫달 ${detail.day}일)`;
  if (freq === 'semiannual' && detail.day) return ` (반기 첫달 ${detail.day}일)`;
  if (freq === 'annual' && detail.month && detail.day)
    return ` (${detail.month}월 ${detail.day}일)`;
  return '';
}

function EditDialog({
  initial,
  employees,
  onClose,
  onDone,
}: {
  initial: Partial<Template> & { department: string };
  employees: Employee[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const isNew = !('id' in initial && initial.id);

  const [title, setTitle] = useState(initial.title ?? '');
  const [department, setDepartment] = useState(initial.department);
  const [kind, setKind] = useState<Kind>((initial.kind as Kind) ?? 'regular');
  const [frequency, setFrequency] = useState<Frequency>(
    (initial.frequency as Frequency) ?? 'daily'
  );
  const [detail, setDetail] = useState<any>(initial.frequency_detail ?? {});
  const [assigneeId, setAssigneeId] = useState<string>(initial.assignee_id ?? '');
  const [linkedDept, setLinkedDept] = useState(initial.linked_dept ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    const payload: any = {
      title: title.trim(),
      department,
      kind,
      frequency: kind === 'regular' ? frequency : null,
      frequency_detail: kind === 'regular' ? detail : {},
      assignee_id: assigneeId || null,
      linked_dept: linkedDept || null,
      memo: memo || null,
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from('task_templates').insert(payload));
    } else {
      ({ error } = await supabase
        .from('task_templates')
        .update(payload)
        .eq('id', (initial as Template).id));
    }
    setBusy(false);
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isNew ? '세부업무 추가' : '세부업무 수정'}</h2>
          <button onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>

        <Field label="업무명">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
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
          <Field label="구분">
            <select
              className="input bg-white"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="regular">정기</option>
              <option value="ad_hoc">수시</option>
              <option value="standing">상시</option>
            </select>
          </Field>
        </div>

        {kind === 'regular' && (
          <>
            <Field label="주기">
              <select
                className="input bg-white"
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value as Frequency);
                  setDetail({});
                }}
              >
                {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <FrequencyDetail frequency={frequency} detail={detail} setDetail={setDetail} />
          </>
        )}

        <Field label="담당자">
          <select
            className="input bg-white"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">(미지정)</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.department.join(', ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="연계부서">
          <input
            className="input"
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
            placeholder="예: 영업본부, 전산팀"
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
            onClick={save}
            disabled={busy}
            className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function FrequencyDetail({
  frequency,
  detail,
  setDetail,
}: {
  frequency: Frequency;
  detail: any;
  setDetail: (d: any) => void;
}) {
  if (frequency === 'daily') return null;
  if (frequency === 'weekly') {
    return (
      <Field label="요일">
        <select
          className="input bg-white"
          value={detail.weekday ?? 1}
          onChange={(e) => setDetail({ weekday: parseInt(e.target.value, 10) })}
        >
          {WEEKDAYS.map((w, i) => (
            <option key={i} value={i}>
              {w}요일
            </option>
          ))}
        </select>
      </Field>
    );
  }
  if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'semiannual') {
    return (
      <Field label="일자 (해당 월의 며칠)">
        <input
          type="number"
          min={1}
          max={28}
          className="input"
          value={detail.day ?? 1}
          onChange={(e) => setDetail({ ...detail, day: parseInt(e.target.value, 10) })}
        />
      </Field>
    );
  }
  if (frequency === 'annual') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="월">
          <input
            type="number"
            min={1}
            max={12}
            className="input"
            value={detail.month ?? 1}
            onChange={(e) =>
              setDetail({ ...detail, month: parseInt(e.target.value, 10) })
            }
          />
        </Field>
        <Field label="일">
          <input
            type="number"
            min={1}
            max={28}
            className="input"
            value={detail.day ?? 1}
            onChange={(e) => setDetail({ ...detail, day: parseInt(e.target.value, 10) })}
          />
        </Field>
      </div>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

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
import ProjectsPanel from './ProjectsPanel';

type Template = {
  id: string;
  department: string;
  title: string;
  kind: Kind;
  frequency: Frequency | null;
  frequency_detail: any;
  assignee_ids: string[];
  linked_dept: string | null;
  memo: string | null;
  active: boolean;
};

type Employee = { id: string; name: string; department: string[] };

type Project = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  deadline: string | null;
  created_at: string;
};

type ProjectMember = { project_id: string; employee_id: string };

type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done';
  linked_dept: string | null;
  linked_dept_contact: string | null;
  memo: string | null;
  assignee_ids: string[];
  order_idx: number;
};

export default function TemplatesClient({
  initial,
  employees,
  projects,
  projectMembers,
  projectTasks,
  linkedDepts,
}: {
  initial: Template[];
  employees: Employee[];
  projects: Project[];
  projectMembers: ProjectMember[];
  projectTasks: ProjectTask[];
  linkedDepts: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<'department' | 'employee' | 'project'>('department');
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id ?? '');
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const supabase = createClient();

  const filtered = initial.filter((t) => {
    if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
    if (view === 'department') return t.department === department;
    if (view === 'employee') return (t.assignee_ids ?? []).includes(employeeId);
    return false;
  });

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
  const renderAssignees = (ids: string[]) =>
    ids.length === 0
      ? '-'
      : ids.map((id) => empById[id] ?? '(삭제됨)').join(', ');

  return (
    <div className="grid grid-cols-[200px_1fr] gap-4">
      <aside className="space-y-1 max-h-[85vh] overflow-auto pr-1">
        <h2 className="text-xs text-slate-500 px-2 mb-1">분야별</h2>
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => {
              setView('department');
              setDepartment(d);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-md ${
              view === 'department' && department === d
                ? 'bg-slate-900 text-white'
                : 'hover:bg-slate-100'
            }`}
          >
            {d}
          </button>
        ))}

        <h2 className="text-xs text-slate-500 px-2 mt-3 mb-1">담당자별</h2>
        {employees.length === 0 && (
          <p className="text-xs text-slate-400 px-2">직원 없음</p>
        )}
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => {
              setView('employee');
              setEmployeeId(e.id);
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-md ${
              view === 'employee' && employeeId === e.id
                ? 'bg-slate-900 text-white'
                : 'hover:bg-slate-100'
            }`}
          >
            {e.name}
          </button>
        ))}

        <div className="pt-2 mt-2 border-t border-slate-200">
          <button
            onClick={() => setView('project')}
            className={`w-full text-left px-3 py-2 text-sm rounded-md font-medium ${
              view === 'project' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
            }`}
          >
            팀 프로젝트
          </button>
        </div>
      </aside>

      {view === 'project' ? (
        <ProjectsPanel
          projects={projects}
          members={projectMembers}
          tasks={projectTasks}
          employees={employees}
          linkedDepts={linkedDepts}
        />
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-white border border-slate-200 rounded-md p-1">
              {(['all', 'regular', 'ad_hoc', 'standing', 'one_time'] as const).map((k) => (
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
                  {view === 'employee' && <th className="text-left px-3 py-2">분야</th>}
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
                    {view === 'employee' && (
                      <td className="px-3 py-2 text-xs">{t.department}</td>
                    )}
                    <td className="px-3 py-2">{KIND_LABEL[t.kind]}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {t.kind === 'regular' && t.frequency
                        ? `${FREQUENCY_LABEL[t.frequency]}${describeDetail(t.frequency, t.frequency_detail)}`
                        : t.kind === 'one_time' && t.frequency_detail?.due_date
                          ? `(${t.frequency_detail.due_date})`
                          : '-'}
                    </td>
                    <td className="px-3 py-2">{renderAssignees(t.assignee_ids ?? [])}</td>
                    <td className="px-3 py-2 text-slate-600">{t.linked_dept ?? '-'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(t)}
                        className={`text-xs px-2 py-0.5 rounded ${
                          t.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
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
                    <td colSpan={view === 'employee' ? 8 : 7} className="px-3 py-8 text-center text-slate-500">
                      등록된 업무가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <EditDialog
          initial={
            editing === 'new'
              ? {
                  department,
                  assignee_ids: view === 'employee' && employeeId ? [employeeId] : [],
                }
              : editing
          }
          employees={employees}
          linkedDepts={linkedDepts}
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
  if (freq === 'weekly' && detail.weekday != null) return ` (${WEEKDAYS[detail.weekday]}요일)`;
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
  linkedDepts,
  onClose,
  onDone,
}: {
  initial: Partial<Template> & { department: string };
  employees: Employee[];
  linkedDepts: string[];
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial.assignee_ids ?? []);
  const [linkedDept, setLinkedDept] = useState(initial.linked_dept ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [busy, setBusy] = useState(false);

  function toggleAssignee(id: string) {
    setAssigneeIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
    );
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);

    if (linkedDept.trim() && !linkedDepts.includes(linkedDept.trim())) {
      await supabase.from('linked_departments').insert({ name: linkedDept.trim() });
    }

    const payload: any = {
      title: title.trim(),
      department,
      kind,
      frequency: kind === 'regular' ? frequency : null,
      frequency_detail:
        kind === 'regular' ? detail : kind === 'one_time' ? { due_date: detail.due_date } : {},
      assignee_ids: assigneeIds,
      linked_dept: linkedDept.trim() || null,
      memo: memo || null,
    };

    let error;
    let templateId: string | undefined;
    if (isNew) {
      const { data, error: e } = await supabase
        .from('task_templates')
        .insert(payload)
        .select()
        .single();
      error = e;
      templateId = data?.id;
    } else {
      ({ error } = await supabase
        .from('task_templates')
        .update(payload)
        .eq('id', (initial as Template).id));
      templateId = (initial as Template).id;
    }

    if (!error && kind === 'one_time' && detail.due_date && templateId) {
      // 일회성: 인스턴스를 즉시 생성
      const insts = assigneeIds.length
        ? assigneeIds.map((aid) => ({
            template_id: templateId,
            assignee_id: aid,
            title: title.trim(),
            department,
            kind: 'one_time',
            due_date: detail.due_date,
            source: 'template',
            linked_dept: linkedDept.trim() || null,
            memo: memo || null,
          }))
        : [
            {
              template_id: templateId,
              assignee_id: null,
              title: title.trim(),
              department,
              kind: 'one_time',
              due_date: detail.due_date,
              source: 'template',
              linked_dept: linkedDept.trim() || null,
              memo: memo || null,
            },
          ];
      await supabase.from('task_instances').insert(insts as any);
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
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setDetail({});
              }}
            >
              <option value="regular">정기</option>
              <option value="ad_hoc">수시</option>
              <option value="standing">상시</option>
              <option value="one_time">일회성</option>
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

        {kind === 'one_time' && (
          <Field label="실행일">
            <input
              type="date"
              className="input"
              value={detail.due_date ?? ''}
              onChange={(e) => setDetail({ due_date: e.target.value })}
            />
          </Field>
        )}

        <Field label="담당자 (복수 선택)">
          <div className="border border-slate-200 rounded-md p-2 max-h-40 overflow-auto">
            {employees.length === 0 && (
              <p className="text-xs text-slate-400">직원이 없습니다.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {employees.map((e) => {
                const checked = assigneeIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleAssignee(e.id)}
                    className={`px-2 py-1 text-xs rounded-md border ${
                      checked
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>
        <Field label="연계부서">
          <input
            className="input"
            list="linked-depts-list"
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
            placeholder="예: 영업본부, 전산팀"
          />
          <datalist id="linked-depts-list">
            {linkedDepts.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
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
            onChange={(e) => setDetail({ ...detail, month: parseInt(e.target.value, 10) })}
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

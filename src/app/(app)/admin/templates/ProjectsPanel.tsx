'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TASK_STATUS_LABEL, type TaskStatus } from '@/lib/constants';

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
  status: TaskStatus;
  linked_dept: string | null;
  linked_dept_contact: string | null;
  memo: string | null;
  assignee_ids: string[];
  order_idx: number;
};

export default function ProjectsPanel({
  projects,
  members,
  tasks,
  employees,
  linkedDepts,
}: {
  projects: Project[];
  members: ProjectMember[];
  tasks: ProjectTask[];
  employees: Employee[];
  linkedDepts: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Project | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const supabase = createClient();

  const empById = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  async function deleteProject(p: Project) {
    if (!confirm(`프로젝트 "${p.title}"를 삭제합니다. 세부업무·멤버도 모두 삭제됩니다. 진행할까요?`))
      return;
    await supabase.from('projects').delete().eq('id', p.id);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">팀 프로젝트</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
        >
          + 프로젝트 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {projects.map((p) => {
          const memberIds = members.filter((m) => m.project_id === p.id).map((m) => m.employee_id);
          const projTasks = tasks.filter((t) => t.project_id === p.id);
          const doneCount = projTasks.filter((t) => t.status === 'done').length;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="text-left bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-400 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{p.title}</h3>
                <span className="text-xs text-slate-500 shrink-0">
                  {doneCount}/{projTasks.length}
                </span>
              </div>
              {p.description && (
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{p.description}</p>
              )}
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                <div>
                  기간: {p.start_date ?? '미정'} ~ {p.deadline ?? '미정'}
                </div>
                <div className="truncate">
                  멤버:{' '}
                  {memberIds.length === 0
                    ? '미지정'
                    : memberIds.map((id) => empById[id] ?? '?').join(', ')}
                </div>
              </div>
            </button>
          );
        })}
        {projects.length === 0 && (
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
            등록된 프로젝트가 없습니다.
          </div>
        )}
      </div>

      {showAdd && (
        <ProjectEditDialog
          mode="new"
          employees={employees}
          existingMemberIds={[]}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}

      {selected && (
        <ProjectDetailDialog
          project={selected}
          tasks={tasks.filter((t) => t.project_id === selected.id)}
          memberIds={members
            .filter((m) => m.project_id === selected.id)
            .map((m) => m.employee_id)}
          employees={employees}
          linkedDepts={linkedDepts}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            router.refresh();
          }}
          onDeleteProject={() => {
            const p = selected;
            setSelected(null);
            deleteProject(p);
          }}
          onChanged={() => router.refresh()}
        />
      )}
    </section>
  );
}

function ProjectEditDialog({
  mode,
  initial,
  employees,
  existingMemberIds,
  onClose,
  onDone,
}: {
  mode: 'new' | 'edit';
  initial?: Project;
  employees: Employee[];
  existingMemberIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(existingMemberIds);
  const [busy, setBusy] = useState(false);

  function toggleMember(id: string) {
    setMemberIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description || null,
      start_date: startDate || null,
      deadline: deadline || null,
    };

    let projectId: string | undefined;
    if (mode === 'new') {
      const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single();
      if (error) {
        alert('생성 실패: ' + error.message);
        setBusy(false);
        return;
      }
      projectId = data.id;
    } else if (initial) {
      const { error } = await supabase.from('projects').update(payload).eq('id', initial.id);
      if (error) {
        alert('수정 실패: ' + error.message);
        setBusy(false);
        return;
      }
      projectId = initial.id;
      // 멤버 동기화: 모두 삭제 후 재추가
      await supabase.from('project_members').delete().eq('project_id', projectId);
    }

    if (projectId && memberIds.length > 0) {
      await supabase
        .from('project_members')
        .insert(memberIds.map((eid) => ({ project_id: projectId, employee_id: eid })));
    }
    setBusy(false);
    onDone();
  }

  return (
    <Modal title={mode === 'new' ? '프로젝트 추가' : '프로젝트 수정'} onClose={onClose}>
      <Field label="제목">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="설명">
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="시작일">
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="데드라인">
          <input
            type="date"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
      </div>
      <Field label="참여 직원 (복수 선택)">
        <div className="border border-slate-200 rounded-md p-2 max-h-40 overflow-auto">
          {employees.length === 0 && (
            <p className="text-xs text-slate-400">직원이 없습니다.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {employees.map((e) => {
              const checked = memberIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleMember(e.id)}
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
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
          취소
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </Modal>
  );
}

function ProjectDetailDialog({
  project,
  tasks,
  memberIds,
  employees,
  linkedDepts,
  onClose,
  onChanged,
  onDeleteProject,
}: {
  project: Project;
  tasks: ProjectTask[];
  memberIds: string[];
  employees: Employee[];
  linkedDepts: string[];
  onClose: () => void;
  onDeleted: () => void;
  onChanged: () => void;
  onDeleteProject: () => void;
}) {
  const supabase = createClient();
  const [editProjectMode, setEditProjectMode] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | 'new' | null>(null);
  const empById = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  async function setStatus(t: ProjectTask, status: TaskStatus) {
    await supabase.from('project_tasks').update({ status }).eq('id', t.id);
    onChanged();
  }
  async function removeTask(t: ProjectTask) {
    if (!confirm('세부업무를 삭제할까요?')) return;
    await supabase.from('project_tasks').delete().eq('id', t.id);
    onChanged();
  }

  const memberNames = memberIds.map((id) => empById[id] ?? '?').join(', ') || '미지정';

  return (
    <Modal title={project.title} onClose={onClose} wide>
      <div className="text-sm text-slate-600 space-y-1">
        {project.description && <p>{project.description}</p>}
        <div className="text-xs text-slate-500">
          기간: {project.start_date ?? '미정'} ~ {project.deadline ?? '미정'} · 멤버: {memberNames}
        </div>
        <div className="flex gap-3 text-xs pt-1">
          <button
            onClick={() => setEditProjectMode(true)}
            className="text-slate-700 hover:underline"
          >
            프로젝트 수정
          </button>
          <button onClick={onDeleteProject} className="text-red-500 hover:underline">
            프로젝트 삭제
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">세부업무 ({tasks.length})</h3>
        <button
          onClick={() => setEditingTask('new')}
          className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs"
        >
          + 세부업무 추가
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-md mt-2 max-h-[50vh] overflow-auto">
        {tasks.length === 0 && (
          <p className="text-xs text-slate-500 p-4 text-center">세부업무가 없습니다.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.id} className="p-3 bg-white">
              <div className="flex items-start gap-2">
                <select
                  value={t.status}
                  onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    t.status === 'done'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : t.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      t.status === 'done' ? 'line-through text-slate-400' : ''
                    }`}
                  >
                    {t.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 space-x-2">
                    {t.assignee_ids?.length > 0 && (
                      <span>
                        담당: {t.assignee_ids.map((id) => empById[id] ?? '?').join(', ')}
                      </span>
                    )}
                    {t.linked_dept && (
                      <span>
                        연계: {t.linked_dept}
                        {t.linked_dept_contact ? ` (${t.linked_dept_contact})` : ''}
                      </span>
                    )}
                  </div>
                  {t.memo && <p className="text-xs text-slate-500 mt-1">{t.memo}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <button onClick={() => setEditingTask(t)} className="text-slate-600 hover:text-slate-900">
                    수정
                  </button>
                  <button onClick={() => removeTask(t)} className="text-slate-400 hover:text-red-600">
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editingTask && (
        <ProjectTaskDialog
          projectId={project.id}
          initial={editingTask === 'new' ? null : editingTask}
          employees={employees}
          memberIds={memberIds}
          linkedDepts={linkedDepts}
          onClose={() => setEditingTask(null)}
          onDone={() => {
            setEditingTask(null);
            onChanged();
          }}
        />
      )}

      {editProjectMode && (
        <ProjectEditDialog
          mode="edit"
          initial={project}
          employees={employees}
          existingMemberIds={memberIds}
          onClose={() => setEditProjectMode(false)}
          onDone={() => {
            setEditProjectMode(false);
            onChanged();
          }}
        />
      )}
    </Modal>
  );
}

function ProjectTaskDialog({
  projectId,
  initial,
  employees,
  memberIds,
  linkedDepts,
  onClose,
  onDone,
}: {
  projectId: string;
  initial: ProjectTask | null;
  employees: Employee[];
  memberIds: string[];
  linkedDepts: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'pending');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assignee_ids ?? []);
  const [linkedDept, setLinkedDept] = useState(initial?.linked_dept ?? '');
  const [contact, setContact] = useState(initial?.linked_dept_contact ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [busy, setBusy] = useState(false);

  function toggleAssignee(id: string) {
    setAssigneeIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
    );
  }

  // 담당자 후보: 프로젝트 멤버 우선 표시 + 그 외 직원도 가능
  const candidates = [
    ...employees.filter((e) => memberIds.includes(e.id)),
    ...employees.filter((e) => !memberIds.includes(e.id)),
  ];

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    if (linkedDept.trim() && !linkedDepts.includes(linkedDept.trim())) {
      await supabase.from('linked_departments').insert({ name: linkedDept.trim() });
    }
    const payload: any = {
      project_id: projectId,
      title: title.trim(),
      status,
      assignee_ids: assigneeIds,
      linked_dept: linkedDept.trim() || null,
      linked_dept_contact: contact.trim() || null,
      memo: memo || null,
    };
    let error;
    if (initial) {
      ({ error } = await supabase.from('project_tasks').update(payload).eq('id', initial.id));
    } else {
      ({ error } = await supabase.from('project_tasks').insert(payload));
    }
    setBusy(false);
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    onDone();
  }

  return (
    <Modal title={initial ? '세부업무 수정' : '세부업무 추가'} onClose={onClose}>
      <Field label="업무명">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="처리 상태">
        <select
          className="input bg-white"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
          {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="담당자 (복수 선택)">
        <div className="border border-slate-200 rounded-md p-2 max-h-40 overflow-auto">
          {candidates.length === 0 && (
            <p className="text-xs text-slate-400">직원이 없습니다.</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((e) => {
              const checked = assigneeIds.includes(e.id);
              const isMember = memberIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleAssignee(e.id)}
                  className={`px-2 py-1 text-xs rounded-md border ${
                    checked
                      ? 'bg-slate-900 text-white border-slate-900'
                      : isMember
                        ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">파란색: 프로젝트 멤버</p>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="연계부서">
          <input
            className="input"
            list="proj-dept-list"
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
          />
          <datalist id="proj-dept-list">
            {linkedDepts.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="연계부서 담당자명">
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
      </div>
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
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div
        className={`bg-white rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 space-y-3 max-h-[90vh] overflow-auto`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400">
            ✕
          </button>
        </div>
        {children}
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

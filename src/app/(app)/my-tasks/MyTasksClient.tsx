'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DEPARTMENTS, KIND_LABEL, FREQUENCY_LABEL, WEEKDAYS,
  type Kind, type Frequency,
} from '@/lib/constants';

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
  projects?: { id: string; title: string; deadline: string | null } | null;
  created_at?: string | null;
};

type ProjectRef = { id: string; title: string };

export default function MyTasksClient({
  me,
  initial,
  todayStr,
  tomorrowStr,
  projectTasks,
  projects,
  linkedDepts,
}: {
  me: Me;
  initial: Instance[];
  todayStr: string;
  tomorrowStr: string;
  projectTasks: ProjectTask[];
  projects: ProjectRef[];
  linkedDepts: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'today' | 'tomorrow' | 'calendar'>('today');
  const [items, setItems] = useState<Instance[]>(initial);
  const [projTasks, setProjTasks] = useState<ProjectTask[]>(projectTasks);
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

  async function setProjTaskStatus(pt: ProjectTask, status: ProjectTask['status']) {
    setProjTasks((arr) => arr.map((x) => (x.id === pt.id ? { ...x, status } : x)));
    await supabase.from('project_tasks').update({ status }).eq('id', pt.id);
  }

  const doneCount = visible.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
          {(['today', 'tomorrow', 'calendar'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm ${
                tab === t ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {t === 'today' ? '오늘' : t === 'tomorrow' ? '내일' : '캘린더'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {tab !== 'calendar' && (
            <span className="text-sm text-slate-500">
              완료 {doneCount}/{visible.length}
            </span>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
          >
            + 업무 추가
          </button>
        </div>
      </div>

      {tab === 'calendar' ? (
        <CalendarView me={me} todayStr={todayStr} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Column
            title="상시업무"
            items={standingItems}
            onItemClick={setDetail}
            onToggle={toggle}
            onRemove={remove}
            todayStr={todayStr}
            color="emerald"
            hideCheckbox
          />
          <Column
            title="수시업무"
            items={adHocItems}
            onItemClick={setDetail}
            onToggle={toggle}
            onRemove={remove}
            todayStr={todayStr}
            color="amber"
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
          <ProjectColumn tasks={projTasks} onStatus={setProjTaskStatus} todayStr={todayStr} />
        </div>
      )}

      {showAdd && (
        <UnifiedAddDialog
          me={me}
          defaultDate={tab === 'tomorrow' ? tomorrowStr : todayStr}
          projects={projects}
          linkedDepts={linkedDepts}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
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

const PROJECT_STATUS_LABEL = { pending: '대기', in_progress: '진행', done: '완료' } as const;

function ProjectColumn({
  tasks,
  onStatus,
  todayStr,
}: {
  tasks: ProjectTask[];
  onStatus: (t: ProjectTask, s: ProjectTask['status']) => void;
  todayStr: string;
}) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const grouped: Record<string, ProjectTask[]> = {};
  tasks.forEach((t) => {
    const k = t.projects?.title ?? '(미상)';
    (grouped[k] ??= []).push(t);
  });
  return (
    <div className="bg-white border border-slate-200 rounded-lg flex flex-col border-l-4 border-l-sky-500">
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200 bg-sky-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-sky-700">프로젝트업무</span>
          <span className="text-xs text-slate-500">
            {done}/{tasks.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-100 flex-1">
        {tasks.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">업무 없음</div>
        )}
        {Object.entries(grouped).map(([projTitle, list]) => (
          <div key={projTitle}>
            <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-600">
              {projTitle}
            </div>
            {list.map((t) => (
              <div key={t.id} className="p-3 flex items-start gap-2">
                <select
                  value={t.status}
                  onChange={(e) => onStatus(t, e.target.value as ProjectTask['status'])}
                  className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${
                    t.status === 'done'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : t.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm ${
                      t.status === 'done'
                        ? 'line-through text-slate-400 font-medium'
                        : t.created_at?.slice(0, 10) === todayStr
                          ? 'text-blue-600 font-bold'
                          : 'font-medium'
                    }`}
                  >
                    {t.title}
                  </div>
                  {(t.linked_dept || t.linked_dept_contact) && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.linked_dept && <>연계: {t.linked_dept}</>}
                      {t.linked_dept_contact && <> ({t.linked_dept_contact})</>}
                    </div>
                  )}
                  {t.memo && (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-2">
                      {t.memo}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
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
  color,
  hideCheckbox,
}: {
  title: string;
  items: Instance[];
  onItemClick: (i: Instance) => void;
  onToggle: (i: Instance) => void;
  onRemove: (i: Instance) => void;
  addButton?: React.ReactNode;
  todayStr: string;
  color: 'emerald' | 'amber' | 'violet';
  hideCheckbox?: boolean;
}) {
  const c = COLOR_MAP[color];
  const done = items.filter((i) => i.status === 'done').length;
  return (
    <div className={`bg-white border ${c.border} ${c.leftBar} rounded-lg flex flex-col`}>
      <div className={`px-3 py-2 flex items-center justify-between border-b ${c.border} ${c.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${c.text}`}>{title}</span>
          {!hideCheckbox && (
            <span className="text-xs text-slate-500">
              {done}/{items.length}
            </span>
          )}
          {hideCheckbox && (
            <span className="text-xs text-slate-500">{items.length}건</span>
          )}
        </div>
        {addButton}
      </div>
      <div className="divide-y divide-slate-100 flex-1">
        {items.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">업무 없음</div>
        )}
        {items.map((inst) => {
          const isFreshlyAdded = inst.created_at?.slice(0, 10) === todayStr;
          return (
          <div
            key={inst.id}
            onClick={() => onItemClick(inst)}
            className="p-3 flex items-start gap-2 cursor-pointer hover:bg-slate-50"
          >
            {!hideCheckbox && (
              <input
                type="checkbox"
                checked={inst.status === 'done'}
                onChange={() => onToggle(inst)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-4 w-4 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-sm ${
                    inst.status === 'done'
                      ? 'line-through text-slate-400 font-medium'
                      : isFreshlyAdded
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
          {inst.kind === 'standing' ? (
            <span className="text-xs text-slate-400">상시업무 (완료 처리 없음)</span>
          ) : (
            <button
              onClick={onToggleStatus}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              {inst.status === 'done' ? '완료 취소' : '완료 처리'}
            </button>
          )}
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

function UnifiedAddDialog({
  me,
  defaultDate,
  projects,
  linkedDepts,
  onClose,
  onDone,
}: {
  me: Me;
  defaultDate: string;
  projects: ProjectRef[];
  linkedDepts: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  type AddKind = 'ad_hoc' | 'standing' | 'regular' | 'one_time' | 'project_task';
  const [kind, setKind] = useState<AddKind>('ad_hoc');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(me.department[0] ?? '인사관리');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [linkedDept, setLinkedDept] = useState('');
  const [memo, setMemo] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [freqDetail, setFreqDetail] = useState<any>({});
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? '');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  async function ensureLinkedDept() {
    if (linkedDept.trim() && !linkedDepts.includes(linkedDept.trim())) {
      await supabase.from('linked_departments').insert({ name: linkedDept.trim() });
    }
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    await ensureLinkedDept();

    if (kind === 'project_task') {
      if (!projectId) {
        alert('프로젝트를 선택하세요.');
        setBusy(false);
        return;
      }
      const { error } = await supabase.from('project_tasks').insert({
        project_id: projectId,
        title: title.trim(),
        status: 'pending',
        assignee_ids: [me.id],
        linked_dept: linkedDept.trim() || null,
        linked_dept_contact: contact.trim() || null,
        memo: memo || null,
      });
      if (error) {
        alert('추가 실패: ' + error.message);
        setBusy(false);
        return;
      }
    } else {
      // task_templates 추가 (정기/수시/상시/일회성)
      const payload: any = {
        department,
        title: title.trim(),
        kind,
        frequency: kind === 'regular' ? frequency : null,
        frequency_detail:
          kind === 'regular' ? freqDetail :
          kind === 'one_time' ? { due_date: dueDate } : {},
        assignee_ids: [me.id],
        linked_dept: linkedDept.trim() || null,
        memo: memo || null,
        active: true,
      };
      const { data: inserted, error } = await supabase
        .from('task_templates')
        .insert(payload)
        .select()
        .single();
      if (error) {
        alert('추가 실패: ' + error.message);
        setBusy(false);
        return;
      }
      // 수시·일회성은 즉시 인스턴스 1개 생성
      if (kind === 'ad_hoc' || kind === 'one_time') {
        await supabase.from('task_instances').insert({
          template_id: inserted.id,
          assignee_id: me.id,
          title: title.trim(),
          department,
          kind,
          due_date: dueDate,
          source: 'template',
          linked_dept: linkedDept.trim() || null,
          memo: memo || null,
          status: 'todo',
        });
      }
    }
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">업무 추가</h2>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="block">
          <span className="block text-xs text-slate-600 mb-1">종류</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AddKind)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="ad_hoc">수시업무</option>
            <option value="standing">상시업무</option>
            <option value="regular">정기업무</option>
            <option value="one_time">일회성업무</option>
            <option value="project_task">프로젝트 세부업무</option>
          </select>
        </label>

        <Input label="업무명" value={title} onChange={setTitle} required />

        {kind !== 'project_task' && (
          <Select
            label="분야"
            value={department}
            onChange={setDepartment}
            options={DEPARTMENTS as readonly string[]}
          />
        )}

        {kind === 'project_task' && (
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">프로젝트</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              {projects.length === 0 && <option value="">(프로젝트 없음)</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
        )}

        {kind === 'regular' && (
          <>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">주기</span>
              <select
                value={frequency}
                onChange={(e) => { setFrequency(e.target.value as Frequency); setFreqDetail({}); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            {frequency === 'weekly' && (
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">요일</span>
                <select
                  value={freqDetail.weekday ?? 1}
                  onChange={(e) => setFreqDetail({ weekday: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                >
                  {WEEKDAYS.map((w, i) => (<option key={i} value={i}>{w}요일</option>))}
                </select>
              </label>
            )}
            {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'semiannual') && (
              <Input
                label="일자 (1~28)"
                type="number"
                value={String(freqDetail.day ?? 1)}
                onChange={(v) => setFreqDetail({ ...freqDetail, day: parseInt(v, 10) || 1 })}
              />
            )}
            {frequency === 'annual' && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="월"
                  type="number"
                  value={String(freqDetail.month ?? 1)}
                  onChange={(v) => setFreqDetail({ ...freqDetail, month: parseInt(v, 10) || 1 })}
                />
                <Input
                  label="일"
                  type="number"
                  value={String(freqDetail.day ?? 1)}
                  onChange={(v) => setFreqDetail({ ...freqDetail, day: parseInt(v, 10) || 1 })}
                />
              </div>
            )}
          </>
        )}

        {(kind === 'ad_hoc' || kind === 'one_time') && (
          <Input label={kind === 'one_time' ? '실행일' : '마감일'} type="date" value={dueDate} onChange={setDueDate} />
        )}

        <Input label="연계부서" value={linkedDept} onChange={setLinkedDept} />
        {kind === 'project_task' && (
          <Input label="연계부서 담당자명" value={contact} onChange={setContact} />
        )}
        <Input label="메모" value={memo} onChange={setMemo} />

        <p className="text-xs text-slate-400">담당자: 본인 ({me.name})</p>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">취소</button>
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

const KIND_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  standing: { label: '상시', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  ad_hoc:   { label: '수시', bg: 'bg-amber-50',   text: 'text-amber-700' },
  regular:  { label: '정기', bg: 'bg-violet-50',  text: 'text-violet-700' },
  one_time: { label: '일회성', bg: 'bg-violet-50', text: 'text-violet-700' },
  project_task: { label: '프로젝트', bg: 'bg-sky-50', text: 'text-sky-700' },
};

function CalendarView({ me, todayStr }: { me: Me; todayStr: string }) {
  const supabase = createClient();
  const [base, setBase] = useState(() => {
    const d = new Date(todayStr + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0-11
  });
  const [instances, setInstances] = useState<Instance[]>([]);
  const [projTasks, setProjTasks] = useState<ProjectTask[]>([]);
  const [empMap, setEmpMap] = useState<Record<string, string>>({ [me.id]: me.name });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstOfMonth = new Date(base.year, base.month, 1);
  const lastOfMonth = new Date(base.year, base.month + 1, 0);
  const fromStr = ymd(firstOfMonth);
  const toStr = ymd(lastOfMonth);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('task_instances')
        .select('*')
        .eq('assignee_id', me.id)
        .gte('due_date', fromStr)
        .lte('due_date', toStr),
      supabase
        .from('project_tasks')
        .select('*, projects(id, title, deadline)')
        .contains('assignee_ids', [me.id]),
      supabase.from('employees').select('id, name'),
    ]).then(([inst, pt, emps]) => {
      setInstances((inst.data ?? []) as any);
      setProjTasks((pt.data ?? []) as any);
      const m: Record<string, string> = {};
      (emps.data ?? []).forEach((e: any) => { m[e.id] = e.name; });
      setEmpMap(m);
      setLoading(false);
    });
  }, [base.year, base.month]); // eslint-disable-line react-hooks/exhaustive-deps

  // 일자별 그룹핑
  const byDate: Record<string, { inst: Instance[]; pt: ProjectTask[] }> = {};
  instances.forEach((i) => {
    (byDate[i.due_date] ??= { inst: [], pt: [] }).inst.push(i);
  });
  projTasks.forEach((t) => {
    const d = t.projects?.deadline;
    if (!d) return;
    if (d < fromStr || d > toStr) return;
    (byDate[d] ??= { inst: [], pt: [] }).pt.push(t);
  });

  // 그리드: 1일이 무슨 요일인지부터
  const firstDow = firstOfMonth.getDay(); // 0=일
  const daysInMonth = lastOfMonth.getDate();
  const cells: ({ day: number; date: string } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(new Date(base.year, base.month, d));
    cells.push({ day: d, date });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    const d = new Date(base.year, base.month - 1, 1);
    setBase({ year: d.getFullYear(), month: d.getMonth() });
  }
  function nextMonth() {
    const d = new Date(base.year, base.month + 1, 1);
    setBase({ year: d.getFullYear(), month: d.getMonth() });
  }

  const detail = selectedDate ? byDate[selectedDate] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-2 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50">‹</button>
          <select
            value={base.year}
            onChange={(e) => setBase({ ...base, year: parseInt(e.target.value, 10) })}
            className="px-2 py-1 text-sm border border-slate-200 rounded bg-white"
          >
            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={base.month}
            onChange={(e) => setBase({ ...base, month: parseInt(e.target.value, 10) })}
            className="px-2 py-1 text-sm border border-slate-200 rounded bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>{m + 1}월</option>
            ))}
          </select>
          <button onClick={nextMonth} className="px-2 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50">›</button>
        </div>
        {loading && <span className="text-xs text-slate-400">로딩…</span>}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {['일','월','화','수','목','금','토'].map((w, i) => (
          <div key={w} className={`py-1 font-medium ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : ''}`}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} className="h-20 bg-slate-50 rounded" />;
          const bucket = byDate[c.date];
          const cnt = (bucket?.inst.length ?? 0) + (bucket?.pt.length ?? 0);
          const isToday = c.date === todayStr;
          const dow = idx % 7;
          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(c.date)}
              className={`h-20 rounded text-left p-1.5 text-xs hover:bg-slate-50 border ${
                isToday ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
              }`}
            >
              <div className={`font-medium ${dow === 0 ? 'text-rose-500' : dow === 6 ? 'text-blue-500' : ''}`}>
                {c.day}
              </div>
              {cnt > 0 && (
                <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px]">
                  {cnt}건
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{selectedDate} 업무</h2>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400">✕</button>
            </div>
            {detail.inst.length === 0 && detail.pt.length === 0 && (
              <p className="text-sm text-slate-500">업무 없음</p>
            )}
            {detail.inst.map((i) => {
              const ks = KIND_STYLE[i.kind ?? 'ad_hoc'] ?? KIND_STYLE.ad_hoc;
              const borderColor =
                i.kind === 'standing' ? 'border-l-emerald-500'
                : i.kind === 'regular' || i.kind === 'one_time' ? 'border-l-violet-500'
                : 'border-l-amber-500';
              return (
                <div key={i.id} className={`border border-slate-200 border-l-4 ${borderColor} rounded p-2.5 text-sm space-y-1`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={i.status === 'done' ? 'line-through text-slate-400 font-medium' : 'font-medium'}>
                      {i.title}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ks.bg} ${ks.text} font-medium`}>
                      {ks.label}
                    </span>
                    {i.department && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{i.department}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>담당: {empMap[i.assignee_id] ?? me.name}</div>
                    {i.linked_dept && <div>연계부서: {i.linked_dept}</div>}
                  </div>
                  {i.memo && <p className="text-xs text-slate-500 whitespace-pre-wrap">{i.memo}</p>}
                </div>
              );
            })}
            {detail.pt.map((t) => {
              const ks = KIND_STYLE.project_task;
              const assignees = (t.assignee_ids ?? []).map((id) => empMap[id] ?? '?').join(', ') || me.name;
              return (
                <div key={t.id} className="border border-slate-200 border-l-4 border-l-sky-500 rounded p-2.5 text-sm space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={t.status === 'done' ? 'line-through text-slate-400 font-medium' : 'font-medium'}>
                      {t.title}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ks.bg} ${ks.text} font-medium`}>
                      {ks.label}
                    </span>
                    {t.projects?.title && (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {t.projects.title}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>담당: {assignees}</div>
                    {t.linked_dept && (
                      <div>
                        연계부서: {t.linked_dept}
                        {t.linked_dept_contact ? ` (${t.linked_dept_contact})` : ''}
                      </div>
                    )}
                  </div>
                  {t.memo && <p className="text-xs text-slate-500 whitespace-pre-wrap">{t.memo}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

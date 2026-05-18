'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DEPARTMENTS,
  FREQUENCY_LABEL,
  WEEKDAYS,
  type Frequency,
} from '@/lib/constants';

type Assignee = { id: string; name: string; department: string[] };
type ProjectRef = { id: string; title: string };

export default function AssignTaskDialog({
  assignee,
  defaultDate,
  projects,
  linkedDepts,
  onClose,
  onDone,
}: {
  assignee: Assignee;
  defaultDate: string;
  projects: ProjectRef[];
  linkedDepts: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  type Kind = 'ad_hoc' | 'standing' | 'regular' | 'one_time' | 'project_task';

  const [kind, setKind] = useState<Kind>('ad_hoc');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(assignee.department[0] ?? '인사관리');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [linkedDept, setLinkedDept] = useState('');
  const [memo, setMemo] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [freqDetail, setFreqDetail] = useState<any>({});
  const [oneTimeMode, setOneTimeMode] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
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
        assignee_ids: [assignee.id],
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
      const oneTimeDetail =
        kind === 'one_time'
          ? oneTimeMode === 'range'
            ? { mode: 'range', start_date: startDate, end_date: endDate }
            : { mode: 'single', due_date: dueDate }
          : {};
      const payload: any = {
        department,
        title: title.trim(),
        kind,
        frequency: kind === 'regular' ? frequency : null,
        frequency_detail:
          kind === 'regular' ? freqDetail : kind === 'one_time' ? oneTimeDetail : {},
        assignee_ids: [assignee.id],
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
      // 수시는 인스턴스 즉시 1개
      if (kind === 'ad_hoc') {
        await supabase.from('task_instances').insert({
          template_id: inserted.id,
          assignee_id: assignee.id,
          title: title.trim(),
          department,
          kind: 'ad_hoc',
          due_date: dueDate,
          source: 'template',
          linked_dept: linkedDept.trim() || null,
          memo: memo || null,
          status: 'todo',
        });
      }
      // 일회성은 모드에 따라 1개 또는 기간 매일
      if (kind === 'one_time') {
        const dates: string[] = [];
        if (oneTimeMode === 'range') {
          const s = new Date(startDate + 'T00:00:00');
          const e = new Date(endDate + 'T00:00:00');
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${dd}`);
          }
        } else {
          dates.push(dueDate);
        }
        const insts = dates.map((due) => ({
          template_id: inserted.id,
          assignee_id: assignee.id,
          title: title.trim(),
          department,
          kind: 'one_time',
          due_date: due,
          source: 'template',
          linked_dept: linkedDept.trim() || null,
          memo: memo || null,
          status: 'todo',
        }));
        if (insts.length > 0) await supabase.from('task_instances').insert(insts);
      }
    }
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{assignee.name}에게 업무 부여</h2>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <label className="block">
          <span className="block text-xs text-slate-600 mb-1">종류</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="input bg-white"
          >
            <option value="ad_hoc">수시업무</option>
            <option value="standing">상시업무</option>
            <option value="regular">정기업무</option>
            <option value="one_time">일회성업무</option>
            <option value="project_task">프로젝트 세부업무</option>
          </select>
        </label>

        <Field label="업무명">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {kind !== 'project_task' && (
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
        )}

        {kind === 'project_task' && (
          <Field label="프로젝트">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="input bg-white"
            >
              {projects.length === 0 && <option value="">(프로젝트 없음)</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'regular' && (
          <>
            <Field label="주기">
              <select
                value={frequency}
                onChange={(e) => { setFrequency(e.target.value as Frequency); setFreqDetail({}); }}
                className="input bg-white"
              >
                {Object.entries(FREQUENCY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            {frequency === 'weekly' && (
              <Field label="요일">
                <select
                  value={freqDetail.weekday ?? 1}
                  onChange={(e) => setFreqDetail({ weekday: parseInt(e.target.value, 10) })}
                  className="input bg-white"
                >
                  {WEEKDAYS.map((w, i) => (<option key={i} value={i}>{w}요일</option>))}
                </select>
              </Field>
            )}
            {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'semiannual') && (
              <Field label="일자 (1~28)">
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="input"
                  value={freqDetail.day ?? 1}
                  onChange={(e) => setFreqDetail({ ...freqDetail, day: parseInt(e.target.value, 10) || 1 })}
                />
              </Field>
            )}
            {frequency === 'annual' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="월">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="input"
                    value={freqDetail.month ?? 1}
                    onChange={(e) => setFreqDetail({ ...freqDetail, month: parseInt(e.target.value, 10) || 1 })}
                  />
                </Field>
                <Field label="일">
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className="input"
                    value={freqDetail.day ?? 1}
                    onChange={(e) => setFreqDetail({ ...freqDetail, day: parseInt(e.target.value, 10) || 1 })}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {kind === 'ad_hoc' && (
          <Field label="마감일">
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        )}

        {kind === 'one_time' && (
          <>
            <Field label="일정 형식">
              <div className="flex gap-2">
                {(['single', 'range'] as const).map((m) => {
                  const active = oneTimeMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOneTimeMode(m)}
                      className={`px-3 py-1.5 text-sm rounded-md border ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'single' ? '일자 지정' : '기간 지정'}
                    </button>
                  );
                })}
              </div>
            </Field>
            {oneTimeMode === 'single' ? (
              <Field label="실행일">
                <input
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="시작일">
                  <input
                    type="date"
                    className="input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="종료일">
                  <input
                    type="date"
                    className="input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        <Field label="연계부서">
          <input
            className="input"
            list="dlg-linked-depts"
            value={linkedDept}
            onChange={(e) => setLinkedDept(e.target.value)}
          />
          <datalist id="dlg-linked-depts">
            {linkedDepts.map((d) => (<option key={d} value={d} />))}
          </datalist>
        </Field>
        {kind === 'project_task' && (
          <Field label="연계부서 담당자명">
            <input
              className="input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </Field>
        )}
        <Field label="메모">
          <textarea
            className="input"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </Field>

        <p className="text-xs text-slate-400">담당자: {assignee.name}</p>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

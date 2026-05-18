'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Recruit = {
  id: string;
  introducer: string | null;
  name: string;
  ssn: string | null;
  phone: string | null;
  address: string | null;
  position: string | null;
  interview_at: string | null;
  interview_template_id: string | null;
  created_at: string;
};

type Editable = Omit<Recruit, 'id' | 'created_at' | 'interview_template_id'> & {
  id: string | 'new';
};

const EMPTY: Editable = {
  id: 'new',
  introducer: '',
  name: '',
  ssn: '',
  phone: '',
  address: '',
  position: '',
  interview_at: '',
};

export default function RecruitsClient({
  initial,
  eduEmployeeIds,
}: {
  initial: Recruit[];
  eduEmployeeIds: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState<Editable | null>(null);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setEditing({ ...EMPTY });
  }
  function startEdit(r: Recruit) {
    setEditing({
      id: r.id,
      introducer: r.introducer ?? '',
      name: r.name,
      ssn: r.ssn ?? '',
      phone: r.phone ?? '',
      address: r.address ?? '',
      position: r.position ?? '',
      interview_at: r.interview_at ? toLocalInput(r.interview_at) : '',
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert('이름을 입력하세요.');
      return;
    }
    setBusy(true);

    const isNew = editing.id === 'new';
    const interviewAt = editing.interview_at ? new Date(editing.interview_at).toISOString() : null;
    const dueDate = editing.interview_at ? editing.interview_at.slice(0, 10) : null;

    // 기존 면접일정과 비교 (수정 시)
    let prevInterviewAt: string | null = null;
    let prevTemplateId: string | null = null;
    if (!isNew) {
      const prev = initial.find((r) => r.id === editing.id);
      prevInterviewAt = prev?.interview_at ?? null;
      prevTemplateId = prev?.interview_template_id ?? null;
    }

    const payload: any = {
      introducer: editing.introducer || null,
      name: editing.name.trim(),
      ssn: editing.ssn || null,
      phone: editing.phone || null,
      address: editing.address || null,
      position: editing.position || null,
      interview_at: interviewAt,
      updated_at: new Date().toISOString(),
    };

    // 1) recruit 저장
    let recruitId = editing.id as string;
    if (isNew) {
      const { data, error } = await supabase
        .from('recruits')
        .insert(payload)
        .select()
        .single();
      if (error) {
        alert('저장 실패: ' + error.message);
        setBusy(false);
        return;
      }
      recruitId = data.id;
    } else {
      const { error } = await supabase
        .from('recruits')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        alert('저장 실패: ' + error.message);
        setBusy(false);
        return;
      }
    }

    // 2) 면접일정 자동 일회성 업무 처리
    const interviewChanged = (prevInterviewAt ?? null) !== (interviewAt ?? null);
    if (interviewChanged) {
      // 이전 template과 인스턴스 제거
      if (prevTemplateId) {
        await supabase.from('task_instances').delete().eq('template_id', prevTemplateId);
        await supabase.from('task_templates').delete().eq('id', prevTemplateId);
      }
      // 새 일회성 업무 생성
      if (interviewAt && dueDate) {
        const tplTitle = `${editing.name.trim()} 면접`;
        const { data: tpl, error: tplErr } = await supabase
          .from('task_templates')
          .insert({
            department: '인사관리',
            title: tplTitle,
            kind: 'one_time',
            frequency_detail: { mode: 'single', due_date: dueDate },
            assignee_ids: eduEmployeeIds,
            active: true,
          })
          .select()
          .single();
        if (!tplErr && tpl) {
          // 담당자별 인스턴스 생성
          const insts = (eduEmployeeIds.length ? eduEmployeeIds : [null]).map((aid) => ({
            template_id: tpl.id,
            assignee_id: aid,
            title: tplTitle,
            department: '인사관리',
            kind: 'one_time',
            due_date: dueDate,
            source: 'template',
            status: 'todo',
          }));
          await supabase.from('task_instances').insert(insts);
          await supabase
            .from('recruits')
            .update({ interview_template_id: tpl.id })
            .eq('id', recruitId);
        }
      } else {
        await supabase
          .from('recruits')
          .update({ interview_template_id: null })
          .eq('id', recruitId);
      }
    }

    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  async function remove(r: Recruit) {
    if (!confirm(`${r.name} 예정자를 삭제하시겠습니까? 자동 생성된 면접 업무도 함께 삭제됩니다.`))
      return;
    if (r.interview_template_id) {
      await supabase.from('task_instances').delete().eq('template_id', r.interview_template_id);
      await supabase.from('task_templates').delete().eq('id', r.interview_template_id);
    }
    await supabase.from('recruits').delete().eq('id', r.id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">입사 예정자 관리</h1>
        <button
          onClick={startNew}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
        >
          + 예정자 추가
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2">소개인</th>
              <th className="text-left px-3 py-2">이름</th>
              <th className="text-left px-3 py-2">주민등록번호</th>
              <th className="text-left px-3 py-2">연락처</th>
              <th className="text-left px-3 py-2">주소</th>
              <th className="text-left px-3 py-2">기본식책</th>
              <th className="text-left px-3 py-2">면접일정</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initial.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{r.introducer ?? '-'}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-slate-600">{r.ssn ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{r.phone ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{r.address ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">{r.position ?? '-'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {r.interview_at ? (
                    <span>
                      {formatKST(r.interview_at)}
                      {r.interview_template_id && (
                        <span className="ml-1 text-xs text-emerald-600">✓ 업무 생성됨</span>
                      )}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() => startEdit(r)}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  등록된 예정자가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {editing.id === 'new' ? '예정자 추가' : '예정자 수정'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-slate-400">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="이름 *">
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="소개인">
                <input
                  className="input"
                  value={editing.introducer ?? ''}
                  onChange={(e) => setEditing({ ...editing, introducer: e.target.value })}
                />
              </Field>
              <Field label="주민등록번호">
                <input
                  className="input"
                  value={editing.ssn ?? ''}
                  onChange={(e) => setEditing({ ...editing, ssn: e.target.value })}
                />
              </Field>
              <Field label="연락처">
                <input
                  className="input"
                  value={editing.phone ?? ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="주소">
              <input
                className="input"
                value={editing.address ?? ''}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
            </Field>
            <Field label="기본식책">
              <input
                className="input"
                value={editing.position ?? ''}
                onChange={(e) => setEditing({ ...editing, position: e.target.value })}
              />
            </Field>
            <Field label="면접일정 (일자 + 시간)">
              <input
                type="datetime-local"
                className="input"
                value={editing.interview_at ?? ''}
                onChange={(e) => setEditing({ ...editing, interview_at: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                일정 입력 시 교육 분야 직원에게 "{editing.name || '예정자'} 면접" 일회성 업무가 자동 생성됩니다.
              </p>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm text-slate-600"
              >
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
          </div>
        </div>
      )}
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

function toLocalInput(iso: string) {
  // 'YYYY-MM-DDTHH:mm' format for datetime-local
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatKST(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

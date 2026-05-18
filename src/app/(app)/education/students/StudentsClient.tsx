'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  name: string;
  phone: string | null;
  has_certificate: boolean;
  has_completion: boolean;
  has_uniform: boolean;
  uses_work_phone: boolean;
  has_business_card: boolean;
  created_at: string;
};

type BoolField =
  | 'has_certificate'
  | 'has_completion'
  | 'has_uniform'
  | 'uses_work_phone'
  | 'has_business_card';

const BOOL_COLS: { key: BoolField; label: string }[] = [
  { key: 'has_certificate', label: '합격증' },
  { key: 'has_completion', label: '수료증' },
  { key: 'has_uniform', label: '근무복' },
  { key: 'uses_work_phone', label: '업무폰사용여부' },
  { key: 'has_business_card', label: '명함제작' },
];

type EditForm = {
  id: string | 'new';
  name: string;
  phone: string;
};

export default function StudentsClient({ initial }: { initial: Student[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Student[]>(initial);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleBool(s: Student, field: BoolField) {
    const next = !s[field];
    // optimistic
    setItems((arr) => arr.map((x) => (x.id === s.id ? { ...x, [field]: next } : x)));
    const { error } = await supabase
      .from('students')
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (error) {
      alert('업데이트 실패: ' + error.message);
      // rollback
      setItems((arr) => arr.map((x) => (x.id === s.id ? { ...x, [field]: !next } : x)));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert('이름을 입력하세요.');
      return;
    }
    setBusy(true);
    const payload = {
      name: editing.name.trim(),
      phone: editing.phone.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editing.id === 'new') {
      const { data, error } = await supabase
        .from('students')
        .insert(payload)
        .select()
        .single();
      if (error) {
        alert('저장 실패: ' + error.message);
        setBusy(false);
        return;
      }
      setItems((arr) => [data as Student, ...arr]);
    } else {
      const { error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        alert('저장 실패: ' + error.message);
        setBusy(false);
        return;
      }
      setItems((arr) =>
        arr.map((x) =>
          x.id === editing.id ? { ...x, name: payload.name, phone: payload.phone } : x
        )
      );
    }
    setBusy(false);
    setEditing(null);
  }

  async function remove(s: Student) {
    if (!confirm(`${s.name} 교육생을 삭제하시겠습니까?`)) return;
    setItems((arr) => arr.filter((x) => x.id !== s.id));
    await supabase.from('students').delete().eq('id', s.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">교육생 관리</h1>
        <button
          onClick={() => setEditing({ id: 'new', name: '', phone: '' })}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
        >
          + 교육생 추가
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2">이름</th>
              <th className="text-left px-3 py-2">연락처</th>
              {BOOL_COLS.map((c) => (
                <th key={c.key} className="text-center px-3 py-2">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-slate-600">{s.phone ?? '-'}</td>
                {BOOL_COLS.map((c) => {
                  const on = s[c.key];
                  return (
                    <td key={c.key} className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleBool(s, c.key)}
                        className={`w-9 h-7 rounded-md text-sm font-semibold border transition ${
                          on
                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                            : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                        }`}
                      >
                        {on ? 'O' : 'X'}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() =>
                      setEditing({ id: s.id, name: s.name, phone: s.phone ?? '' })
                    }
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(s)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={BOOL_COLS.length + 3} className="px-3 py-8 text-center text-slate-500">
                  등록된 교육생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {editing.id === 'new' ? '교육생 추가' : '교육생 수정'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-slate-400">
                ✕
              </button>
            </div>
            <Field label="이름">
              <input
                className="input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="연락처">
              <input
                className="input"
                value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
            </Field>
            <p className="text-xs text-slate-500">
              합격증·수료증·근무복·업무폰사용여부·명함제작은 시트에서 O/X를 클릭해 변경하세요.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-slate-600">
                취소
              </button>
              <button
                onClick={saveEdit}
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

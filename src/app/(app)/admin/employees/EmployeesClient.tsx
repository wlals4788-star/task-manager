'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DEPARTMENTS, padPassword } from '@/lib/constants';

type Employee = {
  id: string;
  login_id: string;
  name: string;
  role: 'admin' | 'staff';
  department: string[];
};

export default function EmployeesClient({ initial }: { initial: Employee[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);

  async function deleteEmployee(emp: Employee) {
    if (!confirm(`${emp.name} 직원을 삭제합니다. 진행할까요?`)) return;
    const res = await fetch('/api/admin/delete-employee', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: emp.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert('삭제 실패: ' + (j.error ?? res.status));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">직원 관리</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm"
        >
          + 직원 추가
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">이름</th>
              <th className="text-left px-3 py-2">아이디</th>
              <th className="text-left px-3 py-2">분야</th>
              <th className="text-left px-3 py-2">권한</th>
              <th className="px-3 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initial.map((e) => (
              <tr
                key={e.id}
                onClick={() => setEditTarget(e)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 text-slate-600">{e.login_id}</td>
                <td className="px-3 py-2">{e.department.join(', ')}</td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      e.role === 'admin' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {e.role === 'admin' ? '관리자' : '직원'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setResetTarget(e);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    비번변경
                  </button>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      deleteEmployee(e);
                    }}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  등록된 직원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddDialog
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {resetTarget && (
        <ResetDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {editTarget && (
        <EditDialog
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            router.refresh();
          }}
          onResetPassword={() => {
            setResetTarget(editTarget);
            setEditTarget(null);
          }}
          onDelete={() => {
            const t = editTarget;
            setEditTarget(null);
            deleteEmployee(t);
          }}
        />
      )}
    </div>
  );
}

function EditDialog({
  target,
  onClose,
  onSuccess,
  onResetPassword,
  onDelete,
}: {
  target: Employee;
  onClose: () => void;
  onSuccess: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(target.name);
  const [role, setRole] = useState<'admin' | 'staff'>(target.role);
  const [department, setDepartment] = useState<string[]>(target.department);
  const [busy, setBusy] = useState(false);

  function toggleDept(d: string) {
    setDepartment((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));
  }

  async function save() {
    if (!name.trim() || department.length === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from('employees')
      .update({
        name: name.trim(),
        role,
        department,
      })
      .eq('id', target.id);
    setBusy(false);
    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }
    onSuccess();
  }

  return (
    <Modal title="직원 정보 수정" onClose={onClose}>
      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
      </Field>
      <Field label="로그인 아이디 (변경 불가)">
        <input value={target.login_id} disabled className="input bg-slate-50 text-slate-500" />
      </Field>
      <Field label="분야 (복수 선택)">
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((d) => {
            const checked = department.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDept(d)}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  checked
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="권한">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
          className="input bg-white"
        >
          <option value="staff">직원</option>
          <option value="admin">관리자</option>
        </select>
      </Field>

      <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-3">
        <div className="flex gap-2">
          <button
            onClick={onResetPassword}
            className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            비밀번호 변경
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50"
          >
            직원 삭제
          </button>
        </div>
        <div className="flex gap-2">
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
      </div>
    </Modal>
  );
}

function AddDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<string[]>([DEPARTMENTS[0]]);
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [busy, setBusy] = useState(false);

  function toggleDept(d: string) {
    setDepartment((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]));
  }

  async function submit() {
    if (!loginId || !password || !name || department.length === 0) return;
    setBusy(true);
    const res = await fetch('/api/admin/create-employee', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password: padPassword(password), name, role, department }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert('생성 실패: ' + (j.error ?? res.status));
      return;
    }
    onSuccess();
  }

  return (
    <Modal title="직원 추가" onClose={onClose}>
      <Field label="이름">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
      </Field>
      <Field label="로그인 아이디">
        <input
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="한글/영문/숫자 가능"
          className="input"
        />
      </Field>
      <Field label="비밀번호 (4자 이상)">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </Field>
      <Field label="분야 (복수 선택)">
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((d) => {
            const checked = department.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDept(d)}
                className={`px-3 py-1.5 text-sm rounded-md border ${
                  checked
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="권한">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
          className="input bg-white"
        >
          <option value="staff">직원</option>
          <option value="admin">관리자</option>
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
          취소
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
        >
          {busy ? '생성 중…' : '생성'}
        </button>
      </div>
    </Modal>
  );
}

function ResetDialog({ target, onClose }: { target: Employee; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (password.length < 4) return alert('4자 이상');
    setBusy(true);
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: target.id, password: padPassword(password) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert('실패: ' + (j.error ?? res.status));
      return;
    }
    alert('변경되었습니다.');
    onClose();
  }
  return (
    <Modal title={`${target.name} 비밀번호 변경`} onClose={onClose}>
      <Field label="새 비밀번호">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
          취소
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-md disabled:opacity-50"
        >
          변경
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
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

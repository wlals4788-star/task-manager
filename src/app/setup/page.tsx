'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEPARTMENTS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { toEmail } from '@/lib/constants';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0] as string);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bootstrap')
      .then((r) => r.json())
      .then((j) => {
        if (j.initialized) router.replace('/login');
        else setChecking(false);
      });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, password, name, department }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '생성 실패');
      setBusy(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithPassword({ email: toEmail(loginId), password });
    router.push('/my-tasks');
    router.refresh();
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">확인 중…</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-3"
      >
        <h1 className="text-xl font-semibold mb-1">최초 관리자 생성</h1>
        <p className="text-sm text-slate-500 mb-3">시스템 초기 설정입니다. 이 화면은 처음 1회만 표시됩니다.</p>

        <Field label="이름">
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="아이디 (영문/숫자)">
          <input
            className="input"
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
          />
        </Field>
        <Field label="비밀번호 (6자 이상)">
          <input
            className="input"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
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

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {busy ? '생성 중…' : '관리자 생성 후 로그인'}
        </button>
      </form>
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

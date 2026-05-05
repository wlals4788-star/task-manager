'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toEmail, padPassword } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(loginId.trim()),
      password: padPassword(password),
    });
    setLoading(false);
    if (error) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }
    router.push('/my-tasks');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-semibold mb-1">경영지원본부</h1>
        <p className="text-sm text-slate-500 mb-6">업무관리 시스템 로그인</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">아이디</label>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-4 text-center">
          최초 사용시{' '}
          <a href="/setup" className="underline hover:text-slate-600">
            관리자 계정 생성
          </a>
        </p>
      </div>
    </div>
  );
}

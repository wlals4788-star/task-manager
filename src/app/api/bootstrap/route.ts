import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { toEmail } from '@/lib/constants';

// 직원이 0명일 때만 동작 — 최초 관리자 1명 생성
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: '이미 초기화되었습니다.' }, { status: 400 });
  }

  const { login_id, password, name, department } = await req.json();
  if (!login_id || !password || !name || !Array.isArray(department) || department.length === 0) {
    return NextResponse.json({ error: '필수값 누락' }, { status: 400 });
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: toEmail(login_id),
    password,
    email_confirm: true,
  });
  if (cErr || !created?.user) {
    return NextResponse.json({ error: cErr?.message ?? '생성 실패' }, { status: 400 });
  }

  const { error: iErr } = await admin.from('employees').insert({
    id: created.user.id,
    login_id,
    name,
    role: 'admin',
    department,
  });
  if (iErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const admin = createAdminClient();
  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true });
  return NextResponse.json({ initialized: (count ?? 0) > 0 });
}

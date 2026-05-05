import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { toEmail } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await supabase
    .from('employees')
    .select('role')
    .eq('id', user.id)
    .single();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { login_id, password, name, role, department } = body as {
    login_id: string;
    password: string;
    name: string;
    role: 'admin' | 'staff';
    department: string[];
  };

  if (!login_id || !password || !name || !role || !Array.isArray(department) || department.length === 0) {
    return NextResponse.json({ error: '필수값 누락' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: toEmail(login_id),
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message ?? '계정 생성 실패' },
      { status: 400 }
    );
  }

  const { error: insertErr } = await admin.from('employees').insert({
    id: created.user.id,
    login_id,
    name,
    role,
    department,
  });
  if (insertErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

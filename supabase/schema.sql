-- ============================================================
-- 경영지원본부 업무관리 시스템 스키마
-- Supabase SQL Editor에 전체 복사하여 실행
-- ============================================================

-- 1. 직원 테이블 (auth.users 1:1 연결)
create table if not exists employees (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text unique not null,
  name text not null,
  role text not null check (role in ('admin','staff')),
  department text[] not null check (
    array_length(department, 1) > 0
    and department <@ array['인사관리','총무','세무회계','정산','교육']::text[]
  ),
  created_at timestamptz default now()
);

-- 2. 업무 마스터 (템플릿)
create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  department text not null check (department in ('인사관리','총무','세무회계','정산','교육')),
  title text not null,
  kind text not null check (kind in ('regular','ad_hoc','standing')),
  frequency text check (frequency in ('daily','weekly','monthly','quarterly','semiannual','annual')),
  frequency_detail jsonb default '{}'::jsonb,
  assignee_id uuid references employees(id) on delete set null,
  linked_dept text,
  memo text,
  active boolean default true,
  created_at timestamptz default now()
);

-- 3. 업무 인스턴스 (일자별 실제 할 일)
create table if not exists task_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references task_templates(id) on delete set null,
  assignee_id uuid references employees(id) on delete set null,
  title text not null,
  department text,
  kind text,
  due_date date not null,
  status text not null default 'todo' check (status in ('todo','done')),
  source text not null check (source in ('template','external')),
  linked_dept text,
  memo text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_instances_assignee_date on task_instances(assignee_id, due_date);
create unique index if not exists idx_instances_template_date
  on task_instances(template_id, due_date) where template_id is not null;

-- ============================================================
-- 권한 헬퍼 함수
-- ============================================================
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists(select 1 from employees where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- RLS 정책
-- ============================================================
alter table employees enable row level security;
alter table task_templates enable row level security;
alter table task_instances enable row level security;

-- employees
drop policy if exists employees_select on employees;
create policy employees_select on employees for select
  using (auth.uid() is not null);

drop policy if exists employees_admin_all on employees;
create policy employees_admin_all on employees for all
  using (is_admin()) with check (is_admin());

-- task_templates
drop policy if exists templates_select on task_templates;
create policy templates_select on task_templates for select
  using (auth.uid() is not null);

drop policy if exists templates_admin_all on task_templates;
create policy templates_admin_all on task_templates for all
  using (is_admin()) with check (is_admin());

-- task_instances
drop policy if exists instances_select_own_or_admin on task_instances;
create policy instances_select_own_or_admin on task_instances for select
  using (assignee_id = auth.uid() or is_admin());

drop policy if exists instances_insert_own_or_admin on task_instances;
create policy instances_insert_own_or_admin on task_instances for insert
  with check (assignee_id = auth.uid() or is_admin());

drop policy if exists instances_update_own_or_admin on task_instances;
create policy instances_update_own_or_admin on task_instances for update
  using (assignee_id = auth.uid() or is_admin())
  with check (assignee_id = auth.uid() or is_admin());

drop policy if exists instances_delete_admin on task_instances;
create policy instances_delete_admin on task_instances for delete
  using (is_admin());

-- ============================================================
-- 정기업무 자동 생성 함수
-- 매일 호출하여 오늘+내일분 인스턴스를 task_templates 기준으로 채움
-- ============================================================
create or replace function generate_daily_instances(target_date date)
returns int language plpgsql security definer as $$
declare
  t record;
  inserted int := 0;
  last_count int;
  due date;
  detail jsonb;
  should_create boolean;
begin
  for t in select * from task_templates where active = true and kind = 'regular' loop
    due := target_date;
    detail := coalesce(t.frequency_detail, '{}'::jsonb);
    should_create := false;

    if t.frequency = 'daily' then
      should_create := true;
    elsif t.frequency = 'weekly' then
      -- detail.weekday: 0=일 ~ 6=토 (Postgres extract dow와 동일)
      should_create := extract(dow from due)::int = coalesce((detail->>'weekday')::int, 1);
    elsif t.frequency = 'monthly' then
      should_create := extract(day from due)::int = coalesce((detail->>'day')::int, 1);
    elsif t.frequency = 'quarterly' then
      should_create := extract(day from due)::int = coalesce((detail->>'day')::int, 1)
        and extract(month from due)::int in (1,4,7,10);
    elsif t.frequency = 'semiannual' then
      should_create := extract(day from due)::int = coalesce((detail->>'day')::int, 1)
        and extract(month from due)::int in (1,7);
    elsif t.frequency = 'annual' then
      should_create := extract(day from due)::int = coalesce((detail->>'day')::int, 1)
        and extract(month from due)::int = coalesce((detail->>'month')::int, 1);
    end if;

    if should_create then
      insert into task_instances(
        template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
      ) values (
        t.id, t.assignee_id, t.title, t.department, t.kind, due, 'template', t.linked_dept, t.memo
      ) on conflict (template_id, due_date) do nothing;
      get diagnostics last_count = row_count;
      inserted := inserted + last_count;
    end if;
  end loop;

  -- 상시업무도 매일 그날치 인스턴스 생성 (없으면)
  for t in select * from task_templates where active = true and kind = 'standing' loop
    insert into task_instances(
      template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
    ) values (
      t.id, t.assignee_id, t.title, t.department, t.kind, target_date, 'template', t.linked_dept, t.memo
    ) on conflict (template_id, due_date) do nothing;
  end loop;

  return inserted;
end;
$$;

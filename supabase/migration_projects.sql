-- ============================================================
-- 팀 프로젝트 기능 마이그레이션
-- ============================================================

-- 연계부서 마스터 (자동완성용)
create table if not exists linked_departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

-- 프로젝트
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date,
  deadline date,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz default now()
);

-- 프로젝트 참여 직원
create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,
  primary key (project_id, employee_id)
);

create index if not exists idx_project_members_employee on project_members(employee_id);

-- 프로젝트 세부업무
create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','done')),
  linked_dept text,
  linked_dept_contact text,
  memo text,
  order_idx int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_project_tasks_project on project_tasks(project_id);

-- ============================================================
-- RLS
-- ============================================================
alter table linked_departments enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_tasks enable row level security;

drop policy if exists linked_dept_select on linked_departments;
create policy linked_dept_select on linked_departments for select using (auth.uid() is not null);

drop policy if exists linked_dept_authed_insert on linked_departments;
create policy linked_dept_authed_insert on linked_departments for insert
  with check (auth.uid() is not null);

drop policy if exists linked_dept_admin_all on linked_departments;
create policy linked_dept_admin_all on linked_departments for all
  using (is_admin()) with check (is_admin());

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (auth.uid() is not null);

drop policy if exists projects_admin_all on projects;
create policy projects_admin_all on projects for all
  using (is_admin()) with check (is_admin());

drop policy if exists project_members_select on project_members;
create policy project_members_select on project_members for select
  using (auth.uid() is not null);

drop policy if exists project_members_admin_all on project_members;
create policy project_members_admin_all on project_members for all
  using (is_admin()) with check (is_admin());

drop policy if exists project_tasks_select on project_tasks;
create policy project_tasks_select on project_tasks for select
  using (auth.uid() is not null);

drop policy if exists project_tasks_admin_all on project_tasks;
create policy project_tasks_admin_all on project_tasks for all
  using (is_admin()) with check (is_admin());

-- 멤버는 자기 프로젝트의 세부업무 status 등 update 가능
drop policy if exists project_tasks_member_update on project_tasks;
create policy project_tasks_member_update on project_tasks for update
  using (
    exists (
      select 1 from project_members
      where project_id = project_tasks.project_id and employee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from project_members
      where project_id = project_tasks.project_id and employee_id = auth.uid()
    )
  );

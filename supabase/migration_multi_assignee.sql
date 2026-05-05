-- task_templates: assignee_id → assignee_ids[] + project_tasks: assignee_ids[] 추가

-- 1) task_templates 컬럼 변경
alter table task_templates
  add column if not exists assignee_ids uuid[] not null default array[]::uuid[];

update task_templates
set assignee_ids = array[assignee_id]
where (assignee_ids = array[]::uuid[]) and assignee_id is not null;

-- 2) project_tasks 에 담당자 array 추가
alter table project_tasks
  add column if not exists assignee_ids uuid[] not null default array[]::uuid[];

-- 3) 기존 unique (template_id, due_date) 제거 — 담당자별 여러 행 허용
drop index if exists idx_instances_template_date;

-- 4) generate_daily_instances 함수 — 담당자 array 모든 멤버에 대해 instance 생성 (idempotent: not exists 체크)
create or replace function generate_daily_instances(target_date date)
returns int language plpgsql security definer as $$
declare
  t record;
  inserted int := 0;
  due date;
  detail jsonb;
  should_create boolean;
  assignees uuid[];
  aid uuid;
begin
  for t in select * from task_templates where active = true and kind = 'regular' loop
    due := target_date;
    detail := coalesce(t.frequency_detail, '{}'::jsonb);
    should_create := false;

    if t.frequency = 'daily' then
      should_create := true;
    elsif t.frequency = 'weekly' then
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
      assignees := coalesce(t.assignee_ids, array[]::uuid[]);
      if array_length(assignees, 1) is null then
        if not exists (
          select 1 from task_instances
          where template_id = t.id and due_date = due and assignee_id is null
        ) then
          insert into task_instances(
            template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
          ) values (
            t.id, null, t.title, t.department, t.kind, due, 'template', t.linked_dept, t.memo
          );
          inserted := inserted + 1;
        end if;
      else
        foreach aid in array assignees loop
          if not exists (
            select 1 from task_instances
            where template_id = t.id and due_date = due and assignee_id = aid
          ) then
            insert into task_instances(
              template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
            ) values (
              t.id, aid, t.title, t.department, t.kind, due, 'template', t.linked_dept, t.memo
            );
            inserted := inserted + 1;
          end if;
        end loop;
      end if;
    end if;
  end loop;

  -- 상시업무
  for t in select * from task_templates where active = true and kind = 'standing' loop
    assignees := coalesce(t.assignee_ids, array[]::uuid[]);
    if array_length(assignees, 1) is null then
      if not exists (
        select 1 from task_instances
        where template_id = t.id and due_date = target_date and assignee_id is null
      ) then
        insert into task_instances(
          template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
        ) values (
          t.id, null, t.title, t.department, t.kind, target_date, 'template', t.linked_dept, t.memo
        );
      end if;
    else
      foreach aid in array assignees loop
        if not exists (
          select 1 from task_instances
          where template_id = t.id and due_date = target_date and assignee_id = aid
        ) then
          insert into task_instances(
            template_id, assignee_id, title, department, kind, due_date, source, linked_dept, memo
          ) values (
            t.id, aid, t.title, t.department, t.kind, target_date, 'template', t.linked_dept, t.memo
          );
        end if;
      end loop;
    end if;
  end loop;

  return inserted;
end;
$$;

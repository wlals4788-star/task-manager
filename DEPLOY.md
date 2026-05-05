# 배포 가이드

## 1) Supabase 설정

1. https://supabase.com 에서 새 프로젝트 생성
2. 좌측 메뉴 **SQL Editor** → `supabase/schema.sql` 전체 내용 복사·붙여넣기 → Run
3. 좌측 메뉴 **Project Settings → API** 에서 다음 3개 값 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (외부 노출 금지)
4. 좌측 메뉴 **Authentication → Providers → Email** 에서
   - **Confirm email** 체크 해제 (가상 이메일 도메인을 쓰므로 검증 메일이 안 옴)

## 2) 로컬 실행 (선택)

```bash
cd task-manager
cp .env.local.example .env.local
# .env.local 에 위 3개 값 채우기
npm run dev
```

브라우저: http://localhost:3000/setup → 최초 관리자 계정 생성 → 로그인

## 3) GitHub 푸시

```bash
cd task-manager
git init
git add .
git commit -m "init: 경영지원 업무관리 시스템"
git branch -M main
# GitHub에 새 빈 저장소(예: task-manager) 만든 뒤
git remote add origin https://github.com/<유저명>/task-manager.git
git push -u origin main
```

## 4) Vercel 배포

1. https://vercel.com 에 GitHub로 가입/로그인
2. **Add New → Project** → 위에서 만든 GitHub 저장소 선택
3. **Environment Variables** 에 3개 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy 클릭 → 1~2분 후 `https://프로젝트명.vercel.app` URL 발급
5. 그 URL의 `/setup` 으로 접속하여 최초 관리자 생성

## 5) 사용 흐름

- **최초 1회**: `/setup` 에서 관리자 1명 생성
- **관리자가 직원 추가**: `/admin/employees` 에서 이름·아이디·비밀번호·분야·권한 입력
- **관리자가 업무 마스터 등록**: `/admin/templates` 에서 분야별 정기/수시/상시 업무 추가, 담당자 지정, 연계부서 입력
- **직원 로그인**: `/login` → 자기 아이디/비밀번호 → `/my-tasks` 에서 오늘/내일 할 일 확인 + 외부 업무 즉석 추가
- **관리자 검토**: `/admin/review` 에서 직원별 최근 7일 업무 진행 확인

## 정기업무 자동 생성 동작

- 직원이 `/my-tasks` 에 진입할 때마다 `generate_daily_instances(today)` 와 `(tomorrow)` 가 호출되어 누락된 인스턴스가 자동 채워짐
- 같은 템플릿+같은 날짜 인스턴스는 unique index로 중복 방지

## 주의

- `SUPABASE_SERVICE_ROLE_KEY` 는 절대 클라이언트 코드/공개 저장소 노출 금지 (Vercel 환경변수에만 보관)
- 가상 이메일 도메인(`@company.local`)은 실제 메일 발송 X. 비밀번호 분실 시 관리자가 `직원 관리 → 비번변경` 으로 재설정

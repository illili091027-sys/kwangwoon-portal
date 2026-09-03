# GitHub Pages + Supabase 설정

1. [Supabase](https://supabase.com/dashboard)에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 `supabase-schema.sql` 전체를 실행합니다.
3. Authentication → Providers → Email에서 이메일 로그인을 켭니다. 실제 학교 이메일 인증을 쓸 경우 Confirm email도 켭니다. 로그인 화면에서는 학교 이메일과 비밀번호를 입력하며, 학번은 가입할 때만 입력합니다.
4. Project Settings → API에서 Project URL과 `anon public` 키를 복사합니다.
5. `js/supabase.config.js`의 두 placeholder를 실제 값으로 바꿉니다. 이 파일은 GitHub에 올려도 됩니다. URL과 **Publishable** 키는 브라우저 공개용이며, 실제 권한은 SQL의 RLS 정책이 제한합니다. `sb_secret_...` 또는 `service_role` 키는 절대로 GitHub에 올리면 안 됩니다.
6. 첫 관리자 계정을 가입한 뒤 SQL Editor에서 `supabase-schema.sql` 마지막 줄의 `YOUR_STUDENT_ID`를 실제 학번으로 바꾸어 실행합니다.

## 중요한 주의점

- 기존 브라우저 `localStorage` 계정과 게시글은 자동으로 이전되지 않습니다. 테스트 데이터라면 새로 가입하는 편이 안전합니다.
- 기존 커스텀 관리자 암호(`kwai2026!?`)는 클라이언트 코드에 노출되어 있어 Supabase 모드에서 사용하지 않습니다. 관리자 권한은 DB의 `profiles.is_admin`으로 관리합니다.

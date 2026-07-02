# 짐프라이스 (GymPrice)

내 주변 헬스장·필라테스의 **실제 가격**을 이용자들이 직접 공유하는 크라우드소싱 플랫폼.

- 카카오맵 기반 주변 헬스장/필라테스 검색 (현재 위치 + 반경 선택 + 지역/업체명 검색)
- 가격 제보: 상품 종류 × 기간 구조화 입력, 최신 제보가 대표값, 과거 이력으로 가격 변동 확인
- 코멘트(후기) + 신고 기능
- 금칙어 자동 차단: 정규화 + 정규식(전화번호/URL/주민번호) + 한글 자모 분해 우회 대응
- 스팸 방지: IP 해시 기반 rate limit, 24시간 중복 제보 차단, honeypot
- 관리자 페이지(`/admin`): 신고 처리, 금칙어 CRUD

## 기술 스택

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + RLS) · 카카오맵 SDK + 카카오 로컬 API · Vercel

## 1. 사전 준비

### 카카오 개발자 (developers.kakao.com)
1. 애플리케이션 생성
2. **JavaScript 키** 복사 → `NEXT_PUBLIC_KAKAO_JS_KEY`
3. **REST API 키** 복사 → `KAKAO_REST_API_KEY`
4. [플랫폼] → Web 도메인 등록: `http://localhost:3000`, 배포 도메인
5. 카카오맵 사용 설정 ON

### Supabase (supabase.com)
1. 새 프로젝트 생성
2. SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 실행
3. Settings → API에서 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (**절대 클라이언트 노출 금지**)

## 2. 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값을 채워넣으세요
npm run dev                  # http://localhost:3000
```

`IP_HASH_SALT`, `ADMIN_SECRET`은 아무 랜덤 문자열로 설정하세요 (예: `openssl rand -hex 16`).

## 3. 배포 (Vercel)

1. GitHub에 push → Vercel에서 Import
2. Environment Variables에 `.env.local`과 동일하게 6개 등록
3. 배포 후 카카오 개발자 콘솔에 배포 도메인 추가

## 4. 운영 메모

- **금칙어 추가**: `/admin` → 금칙어 관리. 코드 배포 없이 즉시 반영(최대 60초 캐시).
- **신고 처리**: `/admin` → 숨김/복구/기각.
- **filter_logs 90일 자동 삭제**: Supabase에서 pg_cron 확장 활성화 후 `schema.sql` 하단 주석의 cron 구문 실행.
- **rate limit 업그레이드**: 현재는 DB 카운트 방식(MVP). 트래픽 증가 시 `src/lib/ratelimit.ts`만 Upstash Redis로 교체하면 됩니다.
- **관리자 인증 업그레이드**: 현재 `ADMIN_SECRET` 단일 비밀번호(MVP). 운영 규모가 커지면 Supabase Auth + 관리자 role로 교체 권장.
- 법적 고지: 페이지 하단에 "이용자 제보 기반" 면책 문구와 Kakao 출처 표기가 포함되어 있습니다. 업체 측 삭제 요청 대응용 문의 이메일을 푸터에 추가하는 것을 권장합니다.

## 폴더 구조

```
src/
  app/
    page.tsx                         # 지도 메인
    place/[kakaoPlaceId]/page.tsx    # 업체 상세 (SSR + SEO 메타)
    admin/page.tsx                   # 관리자
    api/
      places/search/                 # 카카오 프록시 + 가격보유 병합
      places/[kakaoPlaceId]/         # 상세 조회
      places/[kakaoPlaceId]/prices/  # 가격 제보 (필터 파이프라인)
      places/[kakaoPlaceId]/comments/# 코멘트 (필터 파이프라인)
      reports/                       # 신고 접수
      admin/reports/                 # 신고 처리
      admin/banned-words/            # 금칙어 CRUD
  components/
    MapView.tsx                      # 지도 + 검색 + 하단시트
    PlaceDetail.tsx                  # 가격표/코멘트/제보 폼
  lib/
    filter.ts                        # 금칙어 3중 매칭
    hangul.ts                        # 자모 분해
    kakao.ts                         # 카카오 로컬 API
    ratelimit.ts                     # rate limit + 중복 차단
    ip.ts / supabaseAdmin.ts / constants.ts
supabase/schema.sql                  # DB 스키마 + RLS + 시드
```

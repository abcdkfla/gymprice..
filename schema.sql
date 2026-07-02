-- =============================================================
-- 짐프라이스 (GymPrice) DB 스키마
-- Supabase SQL Editor에 전체 붙여넣기 후 실행하세요.
-- =============================================================

-- 업체: 카카오 place_id 기준. 첫 제보가 달릴 때 lazy 생성됨.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  kakao_place_id text unique not null,
  name text not null,
  address text,
  road_address text,
  lat double precision not null,
  lng double precision not null,
  category text default 'gym', -- 'gym' | 'pilates' | 'crossfit' | 'etc'
  created_at timestamptz not null default now()
);
create index if not exists idx_places_kakao on places (kakao_place_id);

-- 가격 제보
create table if not exists price_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  anon_nickname text not null default '익명',
  product_type text not null,  -- 'membership' | 'pt' | 'pilates_group' | 'pilates_private' | 'ot' | 'locker' | 'etc'
  duration text not null,      -- '1m' | '3m' | '6m' | '12m' | 'per10' | 'per20' | 'per30' | 'once'
  price integer not null check (price > 0 and price < 100000000),
  is_event_price boolean not null default false,
  visited_at date,
  status text not null default 'active', -- 'active' | 'hidden' | 'deleted'
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_prices_place on price_reports (place_id, status, created_at desc);
create index if not exists idx_prices_ip on price_reports (ip_hash, created_at desc);

-- 코멘트
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  anon_nickname text not null default '익명',
  content text not null check (char_length(content) <= 500),
  status text not null default 'active',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_place on comments (place_id, status, created_at desc);
create index if not exists idx_comments_ip on comments (ip_hash, created_at desc);

-- 금칙어 (관리자 페이지에서 CRUD)
create table if not exists banned_words (
  id bigint generated always as identity primary key,
  word text not null,
  match_type text not null default 'contains', -- 'contains' | 'regex'
  category text default 'profanity',           -- 'profanity' | 'ad' | 'privacy'
  created_at timestamptz not null default now()
);

-- 신고
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null, -- 'price_report' | 'comment'
  target_id uuid not null,
  reason text,
  status text not null default 'pending', -- 'pending' | 'resolved' | 'rejected'
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reports_status on reports (status, created_at desc);

-- 금칙어 차단 시도 로그 (90일 보관)
create table if not exists filter_logs (
  id uuid primary key default gen_random_uuid(),
  ip_hash text,
  original_text text,
  matched_word text,
  created_at timestamptz not null default now()
);

-- =============================================================
-- RLS: 모든 쓰기는 서버(service role)를 통해서만.
-- 읽기는 active 상태의 places/price_reports/comments만 공개.
-- =============================================================
alter table places enable row level security;
alter table price_reports enable row level security;
alter table comments enable row level security;
alter table banned_words enable row level security;
alter table reports enable row level security;
alter table filter_logs enable row level security;

create policy "public read places" on places
  for select using (true);

create policy "public read active prices" on price_reports
  for select using (status = 'active');

create policy "public read active comments" on comments
  for select using (status = 'active');

-- banned_words / reports / filter_logs 는 정책 없음
-- → anon 키로는 접근 불가, service role 로만 접근 가능.

-- =============================================================
-- 기본 금칙어 시드 (예시 — 운영하며 관리자 페이지에서 추가하세요)
-- =============================================================
insert into banned_words (word, match_type, category) values
  ('시발', 'contains', 'profanity'),
  ('씨발', 'contains', 'profanity'),
  ('병신', 'contains', 'profanity'),
  ('새끼', 'contains', 'profanity'),
  ('문의주세요', 'contains', 'ad'),
  ('디엠주세요', 'contains', 'ad'),
  ('오픈채팅', 'contains', 'ad'),
  ('01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}', 'regex', 'privacy'),
  ('\d{6}[-\s]?[1-4]\d{6}', 'regex', 'privacy'),
  ('https?://\S+', 'regex', 'ad'),
  ('www\.\S+\.\S+', 'regex', 'ad');

-- =============================================================
-- filter_logs 90일 자동 삭제 (pg_cron 확장 사용 시)
-- Supabase Dashboard → Database → Extensions 에서 pg_cron 활성화 후 실행:
-- =============================================================
-- select cron.schedule('purge-filter-logs', '0 4 * * *',
--   $$delete from filter_logs where created_at < now() - interval '90 days'$$);

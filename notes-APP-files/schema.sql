-- ============================================================
-- 私人笔记应用 - Supabase 数据库结构
-- ============================================================

-- ------------------------------------------------------------
-- 1. 分类表 categories
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user_id on public.categories(user_id);

-- ------------------------------------------------------------
-- 2. 笔记表 notes
-- ------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null default '无标题笔记',
  content text not null default '',          -- 富文本 HTML 内容
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_notes_updated_at on public.notes(updated_at desc);
create index if not exists idx_notes_category_id on public.notes(category_id);

-- 全文搜索索引（标题 + 内容）
create index if not exists idx_notes_search
  on public.notes using gin (to_tsvector('simple', title || ' ' || content));

-- ------------------------------------------------------------
-- 3. 自动更新 updated_at 触发器
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 4. 启用 Row Level Security
-- ============================================================
alter table public.categories enable row level security;
alter table public.notes enable row level security;

-- ------------------------------------------------------------
-- categories 策略：用户只能操作自己的分类
-- ------------------------------------------------------------
create policy "用户可查看自己的分类"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "用户可创建自己的分类"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "用户可更新自己的分类"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "用户可删除自己的分类"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- notes 策略：用户只能操作自己的笔记
-- ------------------------------------------------------------
create policy "用户可查看自己的笔记"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "用户可创建自己的笔记"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "用户可更新自己的笔记"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "用户可删除自己的笔记"
  on public.notes for delete
  using (auth.uid() = user_id);

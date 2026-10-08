-- 语音日记 Supabase 初始化脚本
-- 在 Supabase 项目的 SQL Editor 中一次性执行

-- 1. 日记表
create table if not exists diary_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  duration integer not null default 0,
  transcript text not null default '',
  mood text not null default '',
  tags text[] not null default '{}',
  audio_path text not null,
  image_paths text[] not null default '{}'
);

create index if not exists diary_entries_user_created_idx
  on diary_entries (user_id, created_at desc);

-- 2. 行级安全：用户只能读写自己的日记
alter table diary_entries enable row level security;

create policy "owner select" on diary_entries
  for select using (auth.uid() = user_id);

create policy "owner insert" on diary_entries
  for insert with check (auth.uid() = user_id);

create policy "owner delete" on diary_entries
  for delete using (auth.uid() = user_id);

-- 3. 私有媒体桶（音频 + 图片）
insert into storage.buckets (id, name, public)
values ('diary-media', 'diary-media', false)
on conflict (id) do nothing;

-- 4. 存储行级安全：路径第一段必须是自己的 user id
create policy "media owner read" on storage.objects
  for select using (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "media owner write" on storage.objects
  for insert with check (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "media owner delete" on storage.objects
  for delete using (
    bucket_id = 'diary-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

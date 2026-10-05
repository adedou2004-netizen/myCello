-- Mandarin app schema notes
-- Derived from the Oct 5, 2026 Supabase diagram plus the live app.
-- Columns marked [seen] come from the diagram. Columns marked [proposed]
-- were not visible and are recommended so capture, examples, and quizzes work.
-- Apply in Supabase SQL editor only after confirming existing columns.

-- ========== already present ==========

-- mandarin_entries [seen]
-- id uuid pk
-- user_id uuid -> auth.users.id
-- entry_type text            -- character | expression | radical | component
-- simplified text
-- traditional text
-- pinyin text
-- sound_clue text            -- French-ear aid, not a substitute for pinyin
-- meaning_en text
-- meaning_fr text
-- radical text
-- components text
-- phonetic_component text
-- stroke_count int
-- independent_use text       -- nullable in diagram
-- notes text
-- source text
-- tags text                  -- diagram cut off; prefer text[]
-- character_image_path text
-- meaning_image_path text
-- mnemonic_image_path text
-- audio_path text
-- stroke_source text
-- first_learned_at timestamptz
-- last_used_at timestamptz
-- created_at timestamptz
-- updated_at timestamptz

-- mandarin_entry_links [seen]
-- id, user_id, parent_entry_id, child_entry_id, relationship, position, created_at
-- relationship: contains | component_of | example_of | radical_of | variant_of

-- mandarin_exposures [seen]
-- id, user_id, entry_id, exposure_type, context_note, used_at
-- exposure_type: reading | listening | conversation | photo | manual

-- mandarin_review_states [seen]
-- id, user_id, entry_id, skill_type, strength numeric,
-- interval_days int, correct_streak int, last_result text,
-- last_response_ms int, last_reviewed_at, next_review_at, updated_at
-- skill_type: meaning | pinyin | listening | writing | production
-- unique (user_id, entry_id, skill_type)

-- mandarin_review_events [seen]
-- id, user_id, entry_id, skill_type, result, response_ms, hint_used, reviewed_at
-- result: again | hard | good | easy

-- mandarin_character_examples [present in table list, columns not in screenshot]
-- memory_palace_cards [used by the app today]
-- subject_type, subject_text, storage_path, title, note
-- bucket: memory-palace-cards

-- ========== recommended additions ==========

alter table mandarin_entries
  add column if not exists hsk_level int,
  add column if not exists status text default 'new';
-- status: new | learning | review | known | suspended

-- If mandarin_character_examples is empty or incomplete, this is the target shape.
create table if not exists mandarin_character_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references mandarin_entries(id) on delete cascade,
  example_entry_id uuid references mandarin_entries(id) on delete set null,
  surface text not null,
  pinyin text,
  meaning_en text,
  source_type text not null default 'reading',
  source_title text,
  context_note text,
  audio_path text,
  image_path text,
  encountered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Locked: one palace table. Keep memory_palace_cards.
-- Add entry_id and user_id. Do not create mandarin_memory_cards.
-- mandarin_entry_links is for word parts, not pictures.
-- The image file lives in Storage bucket memory-palace-cards.
-- storage_path is the object key inside that bucket, not a second copy of the image.
alter table memory_palace_cards
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists entry_id uuid references mandarin_entries(id) on delete cascade;

-- A lesson is a practice list. The dictionary entry stays unique.
-- The same character can sit in Lesson 3, a book chapter, and a school list.
create table if not exists mandarin_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  lesson_kind text not null default 'custom',
  -- course | book | class | podcast | custom
  source_title text,
  position int,
  parent_lesson_id uuid references mandarin_lessons(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mandarin_lesson_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references mandarin_lessons(id) on delete cascade,
  entry_id uuid not null references mandarin_entries(id) on delete cascade,
  position int not null default 0,
  added_because text not null default 'encountered',
  -- seed | assigned | encountered
  note text,
  created_at timestamptz not null default now(),
  unique (lesson_id, entry_id)
);

alter table mandarin_entries enable row level security;
alter table mandarin_entry_links enable row level security;
alter table mandarin_exposures enable row level security;
alter table mandarin_review_states enable row level security;
alter table mandarin_review_events enable row level security;
alter table mandarin_character_examples enable row level security;
alter table mandarin_lessons enable row level security;
alter table mandarin_lesson_items enable row level security;

-- Policy pattern for every mandarin table:
-- using (user_id = auth.uid()) with check (user_id = auth.uid())

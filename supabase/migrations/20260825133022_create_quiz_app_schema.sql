/*
# AI Quiz Simulator — Core Schema

## Purpose
Stores users (username-based, no auth), uploaded learning materials,
generated quizzes, individual questions, and per-question answers.

## Tables

1. `users`
   - id (uuid PK)
   - username (text, unique) — display name, not a login
   - created_at

2. `materials`
   - id (uuid PK)
   - user_id (uuid FK -> users)
   - filename, file_type, file_size
   - extracted_text — full text extracted from PDF/DOCX or transcript
   - status — processing | ready | failed
   - quiz_count (int, default 0) — denormalized count for list view
   - created_at

3. `quizzes`
   - id (uuid PK)
   - user_id (uuid FK -> users)
   - material_id (uuid FK -> materials)
   - config fields: total_questions, number_of_options, difficulty, style_mode, style_examples, quiz_mode, shuffle_questions, shuffle_options
   - result fields: score, correct_answers, wrong_answers, duration_seconds
   - created_at

4. `questions`
   - id (uuid PK)
   - quiz_id (uuid FK -> quizzes)
   - material_id (uuid FK -> materials) — for cross-quiz duplicate detection
   - question, options (jsonb array), correct_index, explanation, difficulty, source_reference
   - fingerprint (text) — normalized hash for duplicate detection

5. `quiz_answers`
   - id (uuid PK)
   - quiz_id, question_id
   - user_answer (int), is_correct (bool), answered_at

## Security
- No sign-in screen → single-tenant, all policies TO anon, authenticated.
- RLS enabled on every table; full CRUD allowed to anon+authenticated.
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint DEFAULT 0,
  extracted_text text DEFAULT '',
  status text NOT NULL DEFAULT 'processing',
  quiz_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_materials" ON materials;
CREATE POLICY "anon_select_materials" ON materials FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_materials" ON materials;
CREATE POLICY "anon_insert_materials" ON materials FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_materials" ON materials;
CREATE POLICY "anon_update_materials" ON materials FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_materials" ON materials;
CREATE POLICY "anon_delete_materials" ON materials FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Quiz',
  total_questions int NOT NULL DEFAULT 10,
  number_of_options int NOT NULL DEFAULT 4,
  difficulty text NOT NULL DEFAULT 'campuran',
  style_mode text NOT NULL DEFAULT 'default',
  style_examples text DEFAULT '',
  quiz_mode text NOT NULL DEFAULT 'baru',
  shuffle_questions boolean NOT NULL DEFAULT true,
  shuffle_options boolean NOT NULL DEFAULT true,
  score int NOT NULL DEFAULT 0,
  correct_answers int NOT NULL DEFAULT 0,
  wrong_answers int NOT NULL DEFAULT 0,
  duration_seconds int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_quizzes" ON quizzes;
CREATE POLICY "anon_select_quizzes" ON quizzes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quizzes" ON quizzes;
CREATE POLICY "anon_insert_quizzes" ON quizzes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quizzes" ON quizzes;
CREATE POLICY "anon_update_quizzes" ON quizzes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quizzes" ON quizzes;
CREATE POLICY "anon_delete_quizzes" ON quizzes FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_index int NOT NULL DEFAULT 0,
  explanation text DEFAULT '',
  difficulty text DEFAULT 'sedang',
  source_reference text DEFAULT '',
  fingerprint text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  user_answer int DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  answered_at timestamptz DEFAULT now()
);

ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_quiz_answers" ON quiz_answers;
CREATE POLICY "anon_select_quiz_answers" ON quiz_answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quiz_answers" ON quiz_answers;
CREATE POLICY "anon_insert_quiz_answers" ON quiz_answers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quiz_answers" ON quiz_answers;
CREATE POLICY "anon_update_quiz_answers" ON quiz_answers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quiz_answers" ON quiz_answers;
CREATE POLICY "anon_delete_quiz_answers" ON quiz_answers FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_material ON quizzes(material_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_material ON questions(material_id);
CREATE INDEX IF NOT EXISTS idx_questions_fingerprint ON questions(material_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_quiz ON quiz_answers(quiz_id);

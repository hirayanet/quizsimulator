export type MaterialStatus = "processing" | "ready" | "failed";

export interface User {
  id: string;
  username: string;
  gemini_api_key: string;
  avatar_url?: string;
  created_at: string;
}

export interface Material {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  extracted_text: string;
  status: MaterialStatus;
  quiz_count: number;
  created_at: string;
}

export type Difficulty = "mudah" | "sedang" | "sulit" | "campuran";
export type StyleMode = "default" | "custom";
export type QuizMode = "sama" | "baru";

export interface Quiz {
  id: string;
  user_id: string;
  material_id: string;
  title: string;
  total_questions: number;
  number_of_options: number;
  difficulty: Difficulty;
  style_mode: StyleMode;
  style_examples: string;
  quiz_mode: QuizMode;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  duration_seconds: number;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string | null;
  material_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: string;
  source_reference: string;
  fingerprint: string;
  created_at: string;
}

export interface QuizAnswer {
  id: string;
  quiz_id: string;
  question_id: string;
  user_answer: number;
  is_correct: boolean;
  answered_at: string;
}

export interface QuizConfig {
  totalQuestions: number;
  numberOfOptions: number;
  difficulty: Difficulty;
  styleMode: StyleMode;
  styleExamples: string;
  quizMode: QuizMode;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface QuizWithDetails extends Quiz {
  materials?: { filename: string };
  users?: { username: string };
}

export interface QuestionWithAnswer extends Question {
  user_answer?: number;
  is_correct?: boolean;
}

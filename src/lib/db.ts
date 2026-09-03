import { supabase } from "./supabase";
import type {
  User,
  Material,
  Quiz,
  Question,
  QuizAnswer,
  QuizConfig,
  MaterialStatus,
} from "../types";
import { fingerprintQuestion, type GeneratedQuestion } from "./quizGenerator";

/**
 * Buat atau perbarui profil user di tabel `users` berdasarkan auth.uid().
 * Dipanggil setelah login Google berhasil.
 */
export async function syncUserProfile(
  authId: string,
  email: string,
  displayName: string,
  avatarUrl?: string,
): Promise<User> {
  // Coba ambil dulu
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", authId)
    .maybeSingle();

  if (existing) {
    // Update nama/avatar jika ada perubahan dari Google
    const { data, error } = await supabase
      .from("users")
      .update({
        username: displayName || email.split("@")[0],
        avatar_url: avatarUrl || null,
      })
      .eq("id", authId)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  }

  // Buat profil baru
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: authId,
      username: displayName || email.split("@")[0],
      avatar_url: avatarUrl || null,
      gemini_api_key: "",
    })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as User | null;
}

/** Simpan Gemini API key milik user ke database */
export async function saveGeminiKeyToDB(
  userId: string,
  apiKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ gemini_api_key: apiKey })
    .eq("id", userId);
  if (error) throw error;
}

/** Hapus Gemini API key dari database */
export async function clearGeminiKeyFromDB(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ gemini_api_key: "" })
    .eq("id", userId);
  if (error) throw error;
}

export async function createMaterial(
  userId: string,
  filename: string,
  fileType: string,
  fileSize: number,
  extractedText: string,
  status: MaterialStatus = "ready",
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .insert({
      user_id: userId,
      filename,
      file_type: fileType,
      file_size: fileSize,
      extracted_text: extractedText,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Material;
}

export async function getMaterialsByUser(userId: string): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Material[];
}

export async function getMaterialById(id: string): Promise<Material | null> {
  const { data } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as Material | null;
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw error;
}

export async function createQuiz(
  userId: string,
  materialId: string,
  title: string,
  config: QuizConfig,
): Promise<Quiz> {
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      material_id: materialId,
      title,
      total_questions: config.totalQuestions,
      number_of_options: config.numberOfOptions,
      difficulty: config.difficulty,
      style_mode: config.styleMode,
      style_examples: config.styleExamples,
      quiz_mode: config.quizMode,
      shuffle_questions: config.shuffleQuestions,
      shuffle_options: config.shuffleOptions,
      score: 0,
      correct_answers: 0,
      wrong_answers: 0,
      duration_seconds: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Quiz;
}

export async function saveQuestions(
  quizId: string,
  materialId: string,
  questions: GeneratedQuestion[],
): Promise<Question[]> {
  const rows = questions.map((q) => ({
    quiz_id: quizId,
    material_id: materialId,
    question: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    source_reference: q.sourceReference,
    fingerprint: q.fingerprint || fingerprintQuestion(q.question),
  }));

  const { data, error } = await supabase
    .from("questions")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data || []) as Question[];
}

export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as Question[];
}

export async function getQuestionsByMaterial(
  materialId: string,
): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("material_id", materialId);

  if (error) throw error;
  return (data || []) as Question[];
}

export async function getQuizById(id: string): Promise<Quiz | null> {
  const { data } = await supabase
    .from("quizzes")
    .select("*, materials(filename), users(username)")
    .eq("id", id)
    .maybeSingle();
  return data as Quiz | null;
}

export async function getQuizzesByUser(userId: string): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*, materials(filename)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Quiz[];
}

export async function getQuizzesByMaterial(
  materialId: string,
): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("material_id", materialId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Quiz[];
}

export async function updateQuizResults(
  quizId: string,
  correct: number,
  wrong: number,
  durationSeconds: number,
): Promise<void> {
  const score = Math.round((correct / (correct + wrong)) * 100);
  const { error } = await supabase
    .from("quizzes")
    .update({
      correct_answers: correct,
      wrong_answers: wrong,
      score,
      duration_seconds: durationSeconds,
    })
    .eq("id", quizId);

  if (error) throw error;
}

export async function saveAnswers(
  answers: Omit<QuizAnswer, "id" | "answered_at">[],
): Promise<void> {
  if (answers.length === 0) return;
  const { error } = await supabase.from("quiz_answers").insert(answers);
  if (error) throw error;
}

export async function getAnswersByQuiz(quizId: string): Promise<QuizAnswer[]> {
  const { data, error } = await supabase
    .from("quiz_answers")
    .select("*")
    .eq("quiz_id", quizId);

  if (error) throw error;
  return (data || []) as QuizAnswer[];
}

export async function incrementMaterialQuizCount(
  materialId: string,
): Promise<void> {
  const material = await getMaterialById(materialId);
  if (!material) return;
  const { error } = await supabase
    .from("materials")
    .update({ quiz_count: material.quiz_count + 1 })
    .eq("id", materialId);
  if (error) throw error;
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) throw error;
}

export interface LatestQuizSummary {
  id: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  createdAt: string;
  materialName: string;
}

export interface UserStats {
  totalQuizzes: number;
  averageScore: number;
  totalQuestions: number;
  correctAnswers: number;
  recentScores: { label: string; score: number }[];
  /** Quiz yang paling baru dikerjakan (untuk sorotan di dashboard) */
  latestQuiz: LatestQuizSummary | null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const quizzes = await getQuizzesByUser(userId);
  const totalQuizzes = quizzes.length;
  const totalScore = quizzes.reduce((sum, q) => sum + q.score, 0);
  const averageScore =
    totalQuizzes > 0 ? Math.round(totalScore / totalQuizzes) : 0;
  const totalQuestions = quizzes.reduce(
    (sum, q) => sum + q.total_questions,
    0,
  );
  const correctAnswers = quizzes.reduce(
    (sum, q) => sum + q.correct_answers,
    0,
  );

  const recent = quizzes.slice(0, 6).reverse();
  const recentScores = recent.map((q, i) => ({
    label: `Quiz ${totalQuizzes - recent.length + i + 1}`,
    score: q.score,
  }));

  // getQuizzesByUser menyertakan relasi materials(filename)
  const first = quizzes[0];
  const latestRaw = first as (Quiz & {
    materials?: { filename: string } | null;
  }) | undefined;
  const latestQuiz: LatestQuizSummary | null = latestRaw
    ? {
        id: latestRaw.id,
        score: latestRaw.score,
        correctAnswers: latestRaw.correct_answers,
        totalQuestions: latestRaw.total_questions,
        createdAt: latestRaw.created_at,
        materialName: latestRaw.materials?.filename || latestRaw.title || "Quiz",
      }
    : null;

  return {
    totalQuizzes,
    averageScore,
    totalQuestions,
    correctAnswers,
    recentScores,
    latestQuiz,
  };
}

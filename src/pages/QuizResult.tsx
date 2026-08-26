import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trophy, Clock, CheckCircle2, XCircle, RotateCcw, FilePlus, Home, Eye, Loader2, PartyPopper } from "lucide-react";
import { getQuizById, getQuestionsByQuiz, getAnswersByQuiz, getMaterialById, createQuiz, saveQuestions } from "../lib/db";
import { generateQuiz } from "../lib/quizGenerator";
import type { Quiz, Question, QuizAnswer, Material } from "../types";
import { formatDuration, scoreCategory, getScoreColor } from "../lib/utils";
import { Banner } from "../components/Toast";

export default function QuizResult() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz & { materials?: { filename: string }; users?: { username: string } } | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"repeat" | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    Promise.all([
      getQuizById(quizId),
      getQuestionsByQuiz(quizId),
      getAnswersByQuiz(quizId),
    ])
      .then(async ([q, qs, ans]) => {
        setQuiz(q as Quiz & { materials?: { filename: string }; users?: { username: string } });
        setQuestions(qs);
        setAnswers(ans);
        if (q?.material_id) {
          const m = await getMaterialById(q.material_id);
          setMaterial(m);
        }
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  const handleRepeat = async () => {
    if (!quiz || !material) return;
    setAction("repeat");
    setActionError(null);

    try {
      // Create a new quiz with same questions
      const newQuiz = await createQuiz(
        quiz.user_id,
        quiz.material_id,
        quiz.title + " (Ulang)",
        {
          totalQuestions: quiz.total_questions,
          numberOfOptions: quiz.number_of_options,
          difficulty: quiz.difficulty,
          styleMode: quiz.style_mode,
          styleExamples: quiz.style_examples,
          quizMode: "sama",
          shuffleQuestions: quiz.shuffle_questions,
          shuffleOptions: quiz.shuffle_options,
        },
      );

      // Reuse same questions
      const reused = questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        sourceReference: q.source_reference,
        fingerprint: q.fingerprint,
      }));

      await saveQuestions(newQuiz.id, quiz.material_id, reused);
      navigate(`/quiz/play/${newQuiz.id}`);
    } catch {
      setActionError("Gagal membuat ulang quiz. Silakan coba lagi.");
      setAction(null);
    }
  };

  const handleNewQuiz = async () => {
    if (!quiz || !material) return;
    setAction("new");
    setActionError(null);

    try {
      // Get all existing questions for this material to avoid duplicates
      const result = await generateQuiz(
        material.extracted_text,
        {
          totalQuestions: quiz.total_questions,
          numberOfOptions: quiz.number_of_options,
          difficulty: quiz.difficulty,
          styleMode: quiz.style_mode,
          styleExamples: quiz.style_examples,
          quizMode: "baru",
          shuffleQuestions: quiz.shuffle_questions,
          shuffleOptions: quiz.shuffle_options,
        },
        questions, // pass all existing questions as exclusion list
      );

      if (result.questions.length === 0) {
        setActionError(
          "Materi ini sudah banyak digunakan untuk quiz sebelumnya. Coba upload materi tambahan atau kurangi jumlah soal.",
        );
        setAction(null);
        return;
      }

      const newQuiz = await createQuiz(
        quiz.user_id,
        quiz.material_id,
        quiz.title,
        {
          totalQuestions: quiz.total_questions,
          numberOfOptions: quiz.number_of_options,
          difficulty: quiz.difficulty,
          styleMode: quiz.style_mode,
          styleExamples: quiz.style_examples,
          quizMode: "baru",
          shuffleQuestions: quiz.shuffle_questions,
          shuffleOptions: quiz.shuffle_options,
        },
      );

      await saveQuestions(newQuiz.id, quiz.material_id, result.questions);
      navigate(`/quiz/play/${newQuiz.id}`);
    } catch {
      setActionError("Gagal membuat quiz baru. Silakan coba lagi.");
      setAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-neutral-600">Quiz tidak ditemukan.</p>
        <button onClick={() => navigate("/")} className="btn-primary mt-4">Kembali ke Dashboard</button>
      </div>
    );
  }

  const pct = quiz.score;
  const cat = scoreCategory(pct);
  const correct = quiz.correct_answers;
  const wrong = quiz.wrong_answers;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
        {/* Result card */}
        <div className="card mb-5 overflow-hidden">
          <div className="bg-gradient-to-br from-primary-600 to-primary-500 p-6 text-center text-white">
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <PartyPopper size={28} />
              </div>
            </div>
            <h1 className="text-lg font-bold">Quiz Selesai!</h1>
            <p className="text-sm text-white/80">{quiz.users?.username || ""} · {quiz.materials?.filename || quiz.title}</p>
          </div>

          <div className="p-6 text-center">
            <div className={`text-5xl font-bold ${getScoreColor(pct)}`}>{pct}</div>
            <p className="mt-2 text-sm text-neutral-600">
              {correct} dari {correct + wrong} jawaban benar
            </p>
            <div className={`mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${cat.color} bg-neutral-100`}>
              {cat.label}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 border-t border-neutral-100">
            <div className="border-r border-neutral-100 p-4 text-center">
              <CheckCircle2 size={18} className="mx-auto mb-1 text-success-500" />
              <p className="text-lg font-bold text-neutral-800">{correct}</p>
              <p className="text-xs text-neutral-400">Benar</p>
            </div>
            <div className="border-r border-neutral-100 p-4 text-center">
              <XCircle size={18} className="mx-auto mb-1 text-error-500" />
              <p className="text-lg font-bold text-neutral-800">{wrong}</p>
              <p className="text-xs text-neutral-400">Salah</p>
            </div>
            <div className="p-4 text-center">
              <Clock size={18} className="mx-auto mb-1 text-primary-500" />
              <p className="text-lg font-bold text-neutral-800">{formatDuration(quiz.duration_seconds)}</p>
              <p className="text-xs text-neutral-400">Waktu</p>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mb-5">
            <Banner type="warning">{actionError}</Banner>
          </div>
        )}

        {/* Actions */}
        <div className="mb-4 space-y-2.5">
          <button onClick={handleRepeat} disabled={action !== null} className="btn-secondary w-full">
            {action === "repeat" ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
            Ulangi Quiz (Soal Sama)
          </button>
          <button onClick={handleNewQuiz} disabled={action !== null} className="btn-primary w-full">
            {action === "new" ? <Loader2 size={18} className="animate-spin" /> : <FilePlus size={18} />}
            Quiz Baru dari Materi Ini
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate(`/quiz/review/${quizId}`)} className="btn-ghost flex-1">
            <Eye size={16} /> Review Jawaban
          </button>
          <button onClick={() => navigate("/")} className="btn-ghost flex-1">
            <Home size={16} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

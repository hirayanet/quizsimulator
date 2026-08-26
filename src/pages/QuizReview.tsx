import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";
import { getQuizById, getQuestionsByQuiz, getAnswersByQuiz } from "../lib/db";
import type { Quiz, Question, QuizAnswer } from "../types";
import PageHeader from "../components/PageHeader";
import { formatDuration } from "../lib/utils";

const LETTERS = "ABCDE";

export default function QuizReview() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz & { materials?: { filename: string } } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");

  useEffect(() => {
    if (!quizId) return;
    Promise.all([
      getQuizById(quizId),
      getQuestionsByQuiz(quizId),
      getAnswersByQuiz(quizId),
    ])
      .then(([q, qs, ans]) => {
        setQuiz(q as Quiz & { materials?: { filename: string } });
        setQuestions(qs);
        setAnswers(ans);
      })
      .finally(() => setLoading(false));
  }, [quizId]);

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
        <button onClick={() => navigate("/")} className="btn-primary mt-4">Kembali</button>
      </div>
    );
  }

  const answerMap = new Map(answers.map((a) => [a.question_id, a]));

  const filtered = questions.filter((q) => {
    const ans = answerMap.get(q.id);
    if (filter === "correct") return ans?.is_correct;
    if (filter === "wrong") return ans && !ans.is_correct;
    return true;
  });

  const correctCount = questions.filter((q) => answerMap.get(q.id)?.is_correct).length;
  const wrongCount = questions.length - correctCount;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader
        title="Review Jawaban"
        subtitle={quiz.materials?.filename || quiz.title}
        backTo={`/quiz/result/${quizId}`}
      />

      {/* Summary */}
      <div className="card mb-5 p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-neutral-800">{questions.length}</p>
            <p className="text-xs text-neutral-400">Total Soal</p>
          </div>
          <div>
            <p className="text-lg font-bold text-success-600">{correctCount}</p>
            <p className="text-xs text-neutral-400">Benar</p>
          </div>
          <div>
            <p className="text-lg font-bold text-error-600">{wrongCount}</p>
            <p className="text-xs text-neutral-400">Salah</p>
          </div>
        </div>
        <div className="mt-3 border-t border-neutral-100 pt-3 text-center">
          <p className="text-xs text-neutral-400">Durasi: {formatDuration(quiz.duration_seconds)} · Skor: {quiz.score}%</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5 flex gap-2">
        {[
          { value: "all" as const, label: "Semua" },
          { value: "correct" as const, label: "Benar" },
          { value: "wrong" as const, label: "Salah" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filter === f.value
                ? "bg-primary-600 text-white"
                : "bg-white text-neutral-500 border border-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {filtered.map((q, i) => {
          const ans = answerMap.get(q.id);
          const isCorrect = ans?.is_correct;
          const userAnswer = ans?.user_answer;

          return (
            <div key={q.id} className="card p-5 animate-fade-in">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed text-neutral-800">{q.question}</p>
                </div>
                {isCorrect ? (
                  <CheckCircle2 size={20} className="shrink-0 text-success-500" />
                ) : (
                  <XCircle size={20} className="shrink-0 text-error-500" />
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 mb-3">
                {q.options.map((opt, idx) => {
                  const isCorrectOpt = idx === q.correct_index;
                  const isUserOpt = idx === userAnswer;

                  let style = "border-neutral-200 bg-white";
                  if (isCorrectOpt) style = "border-success-300 bg-success-50";
                  else if (isUserOpt && !isCorrectOpt) style = "border-error-300 bg-error-50";

                  return (
                    <div key={idx} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${style}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/60 text-xs font-bold text-neutral-500">
                        {LETTERS[idx]}
                      </span>
                      <span className="flex-1 text-neutral-700">{opt}</span>
                      {isCorrectOpt && <CheckCircle2 size={16} className="text-success-500" />}
                      {isUserOpt && !isCorrectOpt && <XCircle size={16} className="text-error-500" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation */}
              <div className="rounded-lg bg-primary-50/50 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Info size={14} className="text-primary-500" />
                  <span className="text-xs font-bold text-primary-600 uppercase tracking-wide">Penjelasan</span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-700">{q.explanation}</p>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500">Tidak ada soal pada filter ini.</p>
        </div>
      )}

      <button onClick={() => navigate(`/quiz/result/${quizId}`)} className="btn-secondary mt-5 w-full">
        Kembali ke Hasil
      </button>
    </div>
  );
}

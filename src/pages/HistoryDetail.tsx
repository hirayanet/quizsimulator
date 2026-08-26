import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Info, Clock, ChevronRight, Loader2, RotateCcw, Eye } from "lucide-react";
import { getQuizById, getQuestionsByQuiz, getAnswersByQuiz } from "../lib/db";
import type { Quiz, Question, QuizAnswer } from "../types";
import PageHeader from "../components/PageHeader";
import { formatDuration, formatDate, scoreCategory } from "../lib/utils";

const LETTERS = "ABCDE";

export default function HistoryDetail() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz & { materials?: { filename: string }; users?: { username: string } } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    Promise.all([
      getQuizById(quizId),
      getQuestionsByQuiz(quizId),
      getAnswersByQuiz(quizId),
    ])
      .then(([q, qs, ans]) => {
        setQuiz(q as Quiz & { materials?: { filename: string }; users?: { username: string } });
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
        <button onClick={() => navigate("/history")} className="btn-primary mt-4">Kembali ke History</button>
      </div>
    );
  }

  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  const correctCount = questions.filter((q) => answerMap.get(q.id)?.is_correct).length;
  const wrongCount = questions.length - correctCount;
  const cat = scoreCategory(quiz.score);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader title="Detail History" subtitle={quiz.materials?.filename || quiz.title} backTo="/history" />

      {/* Info card */}
      <div className="card mb-5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Peserta" value={quiz.users?.username || "-"} />
          <InfoRow label="Tanggal" value={formatDate(quiz.created_at)} />
          <InfoRow label="Jumlah Soal" value={String(quiz.total_questions)} />
          <InfoRow label="Durasi" value={formatDuration(quiz.duration_seconds)} />
          <InfoRow label="Benar" value={String(correctCount)} color="text-success-600" />
          <InfoRow label="Salah" value={String(wrongCount)} color="text-error-600" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 p-4">
          <div>
            <p className="text-xs text-neutral-400">Skor Akhir</p>
            <p className={`text-3xl font-bold ${cat.color}`}>{quiz.score}%</p>
          </div>
          <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${cat.color} bg-neutral-100`}>{cat.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-5 flex gap-3">
        <button onClick={() => navigate(`/quiz/review/${quizId}`)} className="btn-secondary flex-1">
          <Eye size={16} /> Review Jawaban
        </button>
        <button onClick={() => navigate(`/quiz/result/${quizId}`)} className="btn-secondary flex-1">
          <RotateCcw size={16} /> Ulangi / Quiz Baru
        </button>
      </div>

      {/* Questions list */}
      <h2 className="mb-3 text-sm font-bold text-neutral-500 uppercase tracking-wide">Soal & Jawaban</h2>
      <div className="space-y-3">
        {questions.map((q, i) => {
          const ans = answerMap.get(q.id);
          const isCorrect = ans?.is_correct;
          const isOpen = expanded === q.id;

          return (
            <div key={q.id} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : q.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600">
                  {i + 1}
                </span>
                <p className="flex-1 truncate text-sm font-medium text-neutral-700">{q.question}</p>
                {isCorrect ? (
                  <CheckCircle2 size={18} className="shrink-0 text-success-500" />
                ) : (
                  <XCircle size={18} className="shrink-0 text-error-500" />
                )}
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-neutral-300 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-neutral-100 p-4 animate-fade-in">
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, idx) => {
                      const isCorrectOpt = idx === q.correct_index;
                      const isUserOpt = idx === ans?.user_answer;
                      let style = "border-neutral-200 bg-white";
                      if (isCorrectOpt) style = "border-success-300 bg-success-50";
                      else if (isUserOpt && !isCorrectOpt) style = "border-error-300 bg-error-50";
                      return (
                        <div key={idx} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${style}`}>
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
                  <div className="rounded-lg bg-primary-50/50 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Info size={14} className="text-primary-500" />
                      <span className="text-xs font-bold text-primary-600 uppercase tracking-wide">Penjelasan</span>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-700">{q.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`text-sm font-semibold ${color || "text-neutral-700"}`}>{value}</p>
    </div>
  );
}

void Clock;

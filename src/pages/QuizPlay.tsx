import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ArrowLeft, Trophy, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getQuizById, getQuestionsByQuiz, saveAnswers, updateQuizResults, incrementMaterialQuizCount } from "../lib/db";
import type { Quiz, Question } from "../types";
import { shuffle, formatDuration } from "../lib/utils";
import ProgressBar from "../components/ProgressBar";

/**
 * Final cleanup for single letter artifacts - last line of defense
 * Applied right before rendering in UI
 */
function finalCleanupOption(text: string): string {
  let cleaned = text.trim();
  
  // Remove single letter at the end
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/, "");
  
  // Remove single letter followed by punctuation
  cleaned = cleaned.replace(/\s+[a-zA-Z][.,;:!?]$/, "");
  
  // Remove single letter standing alone
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+/g, " ");
  
  // Remove any single letter at the beginning
  cleaned = cleaned.replace(/^[a-zA-Z]\s+/g, "");
  
  // Remove any single letter followed by space and punctuation
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s+[.,;:!?]/g, " ");
  
  // Remove any single letter word boundaries
  cleaned = cleaned.replace(/\b[a-zA-Z]\b/g, (match, offset, string) => {
    const prevChar = offset > 0 ? string[offset - 1] : ' ';
    const nextChar = offset + 1 < string.length ? string[offset + 1] : ' ';
    if (/[a-zA-Z]/.test(prevChar) && /[a-zA-Z]/.test(nextChar)) {
      return match;
    }
    return '';
  });
  
  // Final cleanup
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/, "");
  
  return cleaned;
}

// Seeded shuffle untuk konsistensi urutan soal
function seededShuffle<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let seedNum = 0;
  for (let i = 0; i < seed.length; i++) {
    seedNum = seedNum + seed.charCodeAt(i);
  }
  
  const random = () => {
    const x = Math.sin(seedNum++) * 10000;
    return x - Math.floor(x);
  };
  
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  
  return arr;
}

const LETTERS = "ABCDE";

export default function QuizPlay() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [rawQuestions, setRawQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => {
    if (!quiz || rawQuestions.length === 0) return [];

    let qs = [...rawQuestions];

    // Gunakan seeded shuffle dengan quizId sebagai seed untuk konsistensi
    if (quiz.shuffle_questions) {
      qs = seededShuffle(qs, quizId || "");
    }

    if (quiz.shuffle_options) {
      qs = qs.map((q, idx) => {
        const optionsWithIndex = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correct_index }));
        // Gunakan seeded shuffle dengan kombinasi quizId + question index sebagai seed
        const shuffled = seededShuffle(optionsWithIndex, (quizId || "") + idx);
        return {
          ...q,
          options: shuffled.map((s) => s.opt),
          correct_index: shuffled.findIndex((s) => s.isCorrect),
        };
      });
    }

    return qs;
  }, [quiz, rawQuestions, quizId]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!quizId) return;
    Promise.all([getQuizById(quizId), getQuestionsByQuiz(quizId)])
      .then(([q, qs]) => {
        if (!q) {
          setError("Quiz tidak ditemukan.");
          return;
        }
        setQuiz(q);
        setRawQuestions(qs);
      })
      .catch(() => setError("Gagal memuat quiz."))
      .finally(() => setLoading(false));
  }, [quizId]);

  const total = questions.length;
  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (idx: number) => {
    setAnswers((prev) => ({ ...prev, [currentIdx]: idx }));
  };

  const handleNext = () => {
    if (currentIdx + 1 < total) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
    }
  };

  const handleSubmit = async () => {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    let correct = 0;
    const answerRecords: { questionId: string; userAnswer: number; isCorrect: boolean }[] = [];

    questions.forEach((q, idx) => {
      const userAnswer = answers[idx] ?? -1;
      const isCorrect = userAnswer === q.correct_index;
      if (isCorrect) correct++;
      answerRecords.push({ questionId: q.id, userAnswer, isCorrect });
    });

    const wrong = total - correct;

    if (quiz) {
      await updateQuizResults(quiz.id, correct, wrong, durationSeconds);
      await saveAnswers(
        answerRecords.map((a) => ({
          quiz_id: quiz.id,
          question_id: a.questionId,
          user_answer: a.userAnswer,
          is_correct: a.isCorrect,
        })),
      );
      await incrementMaterialQuizCount(quiz.material_id);
    }

    navigate(`/quiz/result/${quizId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !quiz || !currentQuestion) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-neutral-600">{error || "Quiz tidak dapat dimuat."}</p>
        <button onClick={() => navigate("/")} className="btn-primary mt-4">
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  const isLastQuestion = currentIdx + 1 === total;
  const hasAnswered = answers[currentIdx] !== undefined;
  const selectedAnswer = answers[currentIdx];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/85 shadow-soft backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (window.confirm("Yakin ingin keluar? Progres quiz ini tidak akan disimpan.")) {
                    navigate("/");
                  }
                }}
                className="flex items-center gap-1.5 rounded-full text-neutral-400 hover:text-error-600 transition"
                title="Keluar dari Quiz"
              >
                <XCircle size={20} />
              </button>
              <span className="text-sm font-bold tracking-wide text-neutral-700">
                SOAL {currentIdx + 1} DARI {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5">
                <Clock size={14} className="text-neutral-400" />
                <span className="text-xs font-semibold text-neutral-600">
                  {formatDuration(Math.round((Date.now() - startTime) / 1000))}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 ring-1 ring-primary-100">
                <Trophy size={14} className="text-primary-600" />
                <span className="text-xs font-bold text-primary-700">
                  {answeredCount}/{total} terjawab
                </span>
              </div>
            </div>
          </div>
          <ProgressBar value={answeredCount} max={total} />
        </div>
      </div>

      {/* Question */}
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="card-elevated animate-fade-in p-6 sm:p-7" key={currentQuestion.id}>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-xs font-bold text-white shadow-glow">
              {currentIdx + 1}
            </span>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {currentQuestion.difficulty}
            </span>
          </div>

          <p className="mb-6 whitespace-pre-line text-lg font-medium leading-relaxed text-neutral-800">
            {currentQuestion.question}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedAnswer === idx;
              let style = "border-neutral-200/80 bg-white/90 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-primary-50/40 hover:shadow-soft";
              let icon = (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-500 transition-colors">
                  {LETTERS[idx]}
                </span>
              );

              if (isSelected) {
                style = "border-primary-400 bg-primary-50 ring-1 ring-primary-200";
                icon = (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white shadow-glow">
                    {LETTERS[idx]}
                  </span>
                );
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition duration-300 active:scale-[0.99] ${style}`}
                >
                  {icon}
                  <span className="flex-1 text-sm font-medium leading-6 text-neutral-700">{finalCleanupOption(opt)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-5 flex items-center gap-3">
          {currentIdx > 0 ? (
            <button onClick={handlePrev} className="btn-secondary !px-4">
              <ArrowLeft size={18} />
              Sebelumnya
            </button>
          ) : (
            <div className="w-[120px]" />
          )}

          <div className="flex flex-1 flex-wrap justify-center gap-1.5">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  idx === currentIdx
                    ? "w-7 bg-gradient-to-r from-primary-600 to-primary-500"
                    : answers[idx] !== undefined
                      ? "w-2.5 bg-primary-300"
                      : "w-2.5 bg-neutral-200"
                }`}
              />
            ))}
          </div>

          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={answeredCount < total}
              className="btn-primary !px-4"
            >
              {answeredCount < total ? `${answeredCount}/${total}` : "Selesai"}
              <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleNext} className="btn-primary !px-4">
              Berikutnya
              <ArrowRight size={18} />
            </button>
          )}
        </div>

        {/* Submit hint on last question */}
        {isLastQuestion && answeredCount < total && (
          <p className="mt-3 text-center text-xs text-neutral-400">
            Masih ada {total - answeredCount} soal yang belum dijawab. Jawab semua soal untuk menyelesaikan quiz.
          </p>
        )}
        {isLastQuestion && answeredCount === total && (
          <p className="mt-3 text-center text-xs text-success-600 font-medium">
            Semua soal telah dijawab. Klik "Selesai" untuk melihat hasil.
          </p>
        )}
      </div>
    </div>
  );
}

void CheckCircle2;
void XCircle;

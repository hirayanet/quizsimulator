import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, ChevronRight, Loader2 } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getQuizzesByUser } from "../lib/db";
import type { Quiz } from "../types";

type QuizWithMaterial = Quiz & { materials?: { filename: string } };
import { formatDate, formatDuration } from "../lib/utils";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

export default function History() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizWithMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getQuizzesByUser(user.id)
      .then(setQuizzes)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const avgScore =
    quizzes.length > 0
      ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
      : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader title="History Quiz" subtitle={`${quizzes.length} quiz telah dikerjakan`} backTo="/" />

      {/* Summary strip */}
      <section className="card-elevated relative mb-6 overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-200/40 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* Ikon + teks pengantar: teks memakai sisa ruang agar tidak terjepit */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-glow">
              <HistoryIcon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">Riwayat pembelajaran</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Lihat kembali hasil quiz yang sudah kamu selesaikan.
              </p>
            </div>
          </div>

          {/* Statistik: dua kolom penuh di mobile, menyamping di layar lebih lebar */}
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div className="glass-panel px-4 py-3 text-center">
              <p className="text-lg font-bold leading-tight text-neutral-800">{quizzes.length}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Quiz</p>
            </div>
            <div className="glass-panel px-4 py-3 text-center">
              <p className={`text-lg font-bold leading-tight ${avgScore >= 75 ? "text-success-600" : avgScore >= 60 ? "text-warning-600" : "text-error-600"}`}>
                {avgScore}%
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Rata-rata</p>
            </div>
          </div>
        </div>
      </section>

      {quizzes.length === 0 ? (
        <div className="card-elevated">
          <EmptyState
            icon={<HistoryIcon size={28} />}
            title="Belum ada riwayat quiz"
            description="Selesaikan quiz pertamamu untuk melihat history di sini."
            action={
              <button onClick={() => navigate("/create")} className="btn-primary">
                Buat Quiz
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quizzes.map((q) => {
            const pct = q.score;
            const scoreColor = pct >= 75 ? "text-success-600" : pct >= 60 ? "text-warning-600" : "text-error-600";
            const scoreBg = pct >= 75 ? "bg-success-50 ring-success-100" : pct >= 60 ? "bg-warning-50 ring-warning-100" : "bg-error-50 ring-error-100";
            const materialTitle = q.materials?.filename || q.title;

            return (
              <button
                key={q.id}
                onClick={() => navigate(`/history/${q.id}`)}
                className="card card-hover flex w-full items-center gap-3.5 p-5 text-left active:scale-[0.99]"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] ring-1 ${scoreBg} ${scoreColor}`}>
                  <span className="text-sm font-bold">{pct}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-800" title={materialTitle}>
                    {materialTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MetaPill>{q.correct_answers}/{q.total_questions} benar</MetaPill>
                    <MetaPill>{formatDuration(q.duration_seconds)}</MetaPill>
                    <MetaPill>{formatDate(q.created_at)}</MetaPill>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-neutral-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
      {children}
    </span>
  );
}

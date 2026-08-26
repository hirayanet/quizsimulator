import { useState, useEffect } from "react";
import { ClipboardList, Target, FileText, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getUserStats, type UserStats } from "../lib/db";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";

export default function Statistics() {
  const { user } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserStats(user.id)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!stats || stats.totalQuizzes === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
        <h1 className="mb-5 text-xl font-bold text-neutral-800">Statistik</h1>
        <div className="card">
          <EmptyState
            icon={<TrendingUp size={28} />}
            title="Belum ada statistik"
            description="Selesaikan quiz pertamamu untuk melihat perkembangan belajar di sini."
          />
        </div>
      </div>
    );
  }

  const accuracyPct = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="mb-5 text-xl font-bold text-neutral-800">Statistik</h1>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<ClipboardList size={20} />} label="Total Quiz" value={stats.totalQuizzes} />
        <StatCard icon={<Target size={20} />} label="Rata-rata Nilai" value={`${stats.averageScore}%`} color="accent" />
        <StatCard icon={<FileText size={20} />} label="Total Soal" value={stats.totalQuestions} color="success" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Jawaban Benar" value={stats.correctAnswers} color="warning" />
      </div>

      {/* Accuracy */}
      <div className="card mb-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Persentase Jawaban Benar</p>
            <p className="text-3xl font-bold text-neutral-800">{accuracyPct}%</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-50 text-success-600">
            <Target size={26} />
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="progress-fill h-full rounded-full bg-success-500" style={{ width: `${accuracyPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          {stats.correctAnswers} dari {stats.totalQuestions} soal terjawab benar
        </p>
      </div>

      {/* Score chart */}
      {stats.recentScores.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold text-neutral-500 uppercase tracking-wide">Perkembangan Nilai</h2>
          <ScoreChart scores={stats.recentScores} />
        </div>
      )}
    </div>
  );
}

function ScoreChart({ scores }: { scores: { label: string; score: number }[] }) {
  const max = 100;
  return (
    <div className="flex items-end justify-between gap-2 h-36">
      {scores.map((s, i) => {
        const h = Math.max(4, (s.score / max) * 100);
        const color = s.score >= 75 ? "bg-success-500" : s.score >= 60 ? "bg-warning-500" : "bg-error-500";
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-neutral-600">{s.score}</span>
            <div className="flex w-full items-end justify-center" style={{ height: "90px" }}>
              <div
                className={`w-full max-w-[36px] rounded-t-lg ${color} transition-all duration-500`}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400 truncate w-full text-center">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

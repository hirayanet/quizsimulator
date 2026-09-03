import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Plus,
  Target,
  Upload,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import StatCard from "../components/StatCard";
import GeminiSetupModal from "../components/GeminiSetupModal";
import { getUserStats, type UserStats } from "../lib/db";
import { formatDate } from "../lib/utils";
import { signInWithGoogle } from "../lib/supabase";
import { hasCohereKey, hasGroqKey, hasOpenRouterKey } from "../lib/settingsStore";

export default function Dashboard() {
  const { user, loading, refreshUser } = useUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (user) {
      getUserStats(user.id).then(setStats).catch(() => setStats(null));
      // Tampilkan onboarding jika belum ada satupun API key
      const hasAnyKey = hasCohereKey(user.id) || hasGroqKey(user.id) || hasOpenRouterKey(user.id);
      if (!hasAnyKey) {
        setShowSetup(true);
      }
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setSignInError(null);
      await signInWithGoogle();
      // Halaman akan di-redirect ke Google, lalu kembali ke sini
    } catch {
      setSignInError("Gagal memulai login Google. Coba lagi.");
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary-600 via-primary-500 to-accent-400 text-white shadow-glow animate-float-slow">
              <BookOpen size={32} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Quiz Simulator</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Ubah materi pembelajaran menjadi quiz interaktif secara otomatis.
            </p>
          </div>

          <div className="card-elevated p-6">
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-50 to-accent-50 p-4">
              <p className="text-sm font-semibold text-neutral-700">Masuk untuk memulai</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Login dengan akun Google untuk menyimpan materi, quiz, dan riwayat belajar Anda.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-semibold text-neutral-700 shadow-soft transition hover:bg-neutral-50 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {signingIn ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {signingIn ? "Mengarahkan ke Google..." : "Masuk dengan Google"}
            </button>

            {signInError && (
              <p className="mt-3 text-center text-xs text-error-600">{signInError}</p>
            )}

            <p className="mt-5 text-center text-xs text-neutral-400">
              Dengan masuk, Anda menyetujui penggunaan data akun Google untuk autentikasi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Nilai siap pakai (tetap aman walau stats belum termuat)
  const latest = stats?.latestQuiz ?? null;
  const hasData = !!latest;
  const totalQuizzes = stats?.totalQuizzes ?? 0;
  const averageScore = stats?.averageScore ?? 0;
  const totalQuestions = stats?.totalQuestions ?? 0;
  const correctAnswers = stats?.correctAnswers ?? 0;
  const recentScores = stats?.recentScores ?? [];
  const hasChart = recentScores.length > 1;

  return (
    <>
      {/* Onboarding modal — muncul otomatis jika belum ada API key */}
      {showSetup && user && (
        <GeminiSetupModal
          user={user}
          onComplete={async () => {
            await refreshUser();
            setShowSetup(false);
          }}
          onSkip={() => setShowSetup(false)}
        />
      )}

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
              Halo, {user.username}!
            </h1>
            <p className="mt-1 truncate text-sm text-neutral-500">
              {hasData
                ? "Lanjutkan belajarmu — buat quiz baru atau lihat skor terakhir."
                : "Siap memulai? Ikuti langkah singkat di bawah."}
            </p>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white shadow-glow transition duration-300 hover:-translate-y-0.5"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </button>
        </div>

        {hasData ? (
          <>
            {/* Sorotan: quiz terakhir + aksi utama */}
            <section className="card-elevated relative mb-6 overflow-hidden p-5 sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-200/40 blur-3xl" />
              <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] ring-1 ${
                      latest!.score >= 75
                        ? "bg-success-50 text-success-600 ring-success-100"
                        : latest!.score >= 60
                          ? "bg-warning-50 text-warning-600 ring-warning-100"
                          : "bg-error-50 text-error-600 ring-error-100"
                    }`}
                  >
                    <span className="text-xl font-bold">{latest!.score}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      Quiz terakhir
                    </p>
                    <p className="mt-0.5 truncate text-base font-bold tracking-tight text-neutral-800">
                      {latest!.materialName}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {latest!.correctAnswers}/{latest!.totalQuestions} benar · {formatDate(latest!.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
                  <button
                    onClick={() => navigate("/history")}
                    className="btn-secondary flex-1 !px-5 !py-3 sm:flex-none"
                  >
                    <History size={16} />
                    Riwayat
                  </button>
                  <button
                    onClick={() => navigate("/create")}
                    className="btn-primary flex-1 !px-5 !py-3 sm:flex-none"
                  >
                    <Plus size={16} />
                    Buat Quiz Baru
                  </button>
                </div>
              </div>
            </section>

            {/* Ringkasan performa */}
            <p className="section-title">Ringkasan performa</p>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={<ClipboardList size={20} />} label="Total Quiz" value={totalQuizzes} />
              <StatCard icon={<Target size={20} />} label="Rata-rata Nilai" value={`${averageScore}%`} color="accent" />
              <StatCard icon={<FileText size={20} />} label="Total Soal" value={totalQuestions} color="success" />
              <StatCard icon={<CheckCircle2 size={20} />} label="Jawaban Benar" value={correctAnswers} color="warning" />
            </div>

            {/* Perkembangan nilai */}
            {hasChart && (
              <section className="card-elevated p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="section-title !mb-1">Perkembangan nilai</p>
                    <h3 className="text-lg font-bold tracking-tight text-neutral-800">Performa quiz terbaru</h3>
                  </div>
                  <div className="badge-soft">
                    <BarChart3 size={14} />
                    {recentScores.length} data
                  </div>
                </div>
                <ScoreChart scores={recentScores} />
              </section>
            )}
          </>
        ) : (
          <StartGuide onCreate={() => navigate("/create")} />
        )}
      </div>
    </>
  );
}

/** Panduan ringkas untuk pengguna baru — fokus pada satu aksi utama */
function StartGuide({ onCreate }: { onCreate: () => void }) {
  const steps = [
    { num: 1, title: "Upload materi", desc: "Pilih file PDF atau DOCX" },
    { num: 2, title: "Atur quiz", desc: "Jumlah soal & tingkat kesulitan" },
    { num: 3, title: "Mainkan & pantau", desc: "Skor masuk ke Statistik" },
  ];

  return (
    <section className="card-elevated relative overflow-hidden p-6 sm:p-8">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary-200/40 blur-3xl" />
      <div className="absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-accent-200/40 blur-3xl" />
      <div className="relative z-10">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Mulai dari materi pertamamu
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600 sm:text-base">
            Unggah materi belajar, lalu ubah menjadi quiz latihan interaktif secara otomatis.
          </p>
          <button onClick={onCreate} className="btn-primary mt-5 w-full sm:w-auto">
            <Upload size={18} />
            Upload Materi &amp; Buat Quiz
          </button>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.num} className="glass-panel flex items-center gap-3.5 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white shadow-glow">
                {s.num}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-800">{s.title}</p>
                <p className="mt-0.5 truncate text-xs leading-5 text-neutral-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScoreChart({ scores }: { scores: { label: string; score: number }[] }) {
  const max = 100;
  const best = Math.max(...scores.map((s) => s.score));

  return (
    <div className="rounded-3xl bg-gradient-to-b from-neutral-50 to-white p-4">
      <div className="flex h-44 items-end justify-between gap-2">
        {scores.map((s, i) => {
          const h = Math.max(10, (s.score / max) * 100);
          const color = s.score >= 75
            ? "from-success-400 to-success-600"
            : s.score >= 60
              ? "from-warning-400 to-warning-500"
              : "from-error-400 to-error-600";

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">{s.score}</span>
              <div className="flex w-full items-end justify-center rounded-2xl bg-white/80 px-2 pb-2 pt-4 shadow-soft" style={{ height: "132px" }}>
                <div
                  className={`w-full max-w-[38px] rounded-2xl bg-gradient-to-t ${color} transition-all duration-500`}
                  style={{ height: `${h}%` }}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] font-medium text-neutral-400">{s.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/60 pt-3 text-[11px] text-neutral-400">
        <span>
          <span className="font-semibold text-success-600">≥75</span> hijau ·{" "}
          <span className="font-semibold text-warning-600">60–74</span> kuning ·{" "}
          <span className="font-semibold text-error-600">&lt;60</span> merah
        </span>
        <span className="font-semibold text-neutral-500">Nilai terbaik: {best}%</span>
      </div>
    </div>
  );
}

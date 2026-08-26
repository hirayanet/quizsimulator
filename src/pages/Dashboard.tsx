import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import GeminiSetupModal from "../components/GeminiSetupModal";
import { getUserStats, type UserStats } from "../lib/db";
import { signInWithGoogle } from "../lib/supabase";
import { hasGeminiKey } from "../lib/geminiKeyStore";


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
      // Tampilkan onboarding jika belum ada Gemini API key
      if (!hasGeminiKey(user.id, user.gemini_api_key)) {
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
              <Sparkles size={32} />
            </div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 shadow-soft backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              Powered by Gemini AI
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">AI Quiz Simulator</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Ubah materi pembelajaran menjadi quiz interaktif secara otomatis dengan kecerdasan buatan.
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

  const hasData = stats && stats.totalQuizzes > 0;

  return (
    <>
      {/* Onboarding modal — muncul otomatis jika belum ada Gemini API key */}
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="badge-soft mb-3">
            <Sparkles size={14} />
            Dashboard belajar
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Halo, {user.username}!</h1>
          <p className="mt-1 text-sm text-neutral-500">Mari buat sesi belajar hari ini terasa lebih seru dan terstruktur.</p>
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

      <section className="card-elevated relative mb-6 overflow-hidden p-6 sm:p-7">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary-200/50 blur-3xl" />
        <div className="absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-accent-200/50 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <div className="badge-soft mb-4">
              <span className="h-2 w-2 rounded-full bg-success-500" />
              Workspace aktif
            </div>
            <h2 className="max-w-xl text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Bangun quiz dari materi Anda dengan pengalaman yang lebih interaktif.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">
              Upload materi, buat konfigurasi soal, lalu pantau hasilnya dalam dashboard yang lebih jelas dan nyaman dilihat.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate("/create")} className="btn-primary">
                <Plus size={18} />
                Buat Quiz Baru
              </button>
              <button onClick={() => navigate("/materials")} className="btn-secondary">
                <FileText size={18} />
                Lihat Materi
              </button>
            </div>
          </div>

          <div className="glass-panel p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Sorotan cepat</p>
            <div className="mt-4 space-y-3">
              <HighlightRow
                title="Mode latihan"
                value={hasData ? "Siap digunakan" : "Belum ada quiz"}
                tone={hasData ? "success" : "warning"}
              />
              <HighlightRow
                title="Total aktivitas"
                value={hasData ? `${stats!.totalQuizzes} quiz tersimpan` : "Mulai dari dashboard"}
                tone="primary"
              />
              <HighlightRow
                title="Rata-rata nilai"
                value={hasData ? `${stats!.averageScore}%` : "Belum tersedia"}
                tone="accent"
              />
            </div>
          </div>
        </div>
      </section>

      {hasData ? (
        <>
          <p className="section-title">Ringkasan performa</p>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<ClipboardList size={20} />} label="Total Quiz" value={stats!.totalQuizzes} />
            <StatCard icon={<Target size={20} />} label="Rata-rata Nilai" value={`${stats!.averageScore}%`} color="accent" />
            <StatCard icon={<FileText size={20} />} label="Total Soal" value={stats!.totalQuestions} color="success" />
            <StatCard icon={<CheckCircle2 size={20} />} label="Jawaban Benar" value={stats!.correctAnswers} color="warning" />
          </div>

          {stats!.recentScores.length > 1 && (
            <section className="card-elevated mb-6 p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="section-title !mb-1">Perkembangan nilai</p>
                  <h3 className="text-lg font-bold tracking-tight text-neutral-800">Performa quiz terbaru</h3>
                </div>
                <div className="badge-soft">
                  <BarChart3 size={14} />
                  {stats!.recentScores.length} data
                </div>
              </div>
              <ScoreChart scores={stats!.recentScores} />
            </section>
          )}
        </>
      ) : (
        <div className="card-elevated mb-6">
          <EmptyState
            icon={<ClipboardList size={28} />}
            title="Belum ada riwayat quiz"
            description="Upload materi pertamamu dan mulai sesi latihan agar dashboard ini terisi statistik yang lebih menarik."
            action={
              <button onClick={() => navigate("/create")} className="btn-primary">
                <Plus size={18} /> Buat Quiz
              </button>
            }
          />
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="section-title !mb-0">Aksi cepat</p>
          <span className="text-xs font-medium text-neutral-400">Pilih menu untuk lanjut</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink
            icon={<Plus />}
            label="Buat Quiz"
            description="Upload materi baru dan mulai generate soal."
            onClick={() => navigate("/create")}
          />
          <QuickLink
            icon={<FileText />}
            label="Materi Saya"
            description="Kelola file belajar yang sudah Anda simpan."
            onClick={() => navigate("/materials")}
          />
          <QuickLink
            icon={<History />}
            label="History"
            description="Lihat sesi quiz yang pernah dikerjakan."
            onClick={() => navigate("/history")}
          />
          <QuickLink
            icon={<BarChart3 />}
            label="Statistik"
            description="Pantau progres dan hasil belajar terbaru."
            onClick={() => navigate("/statistics")}
          />
        </div>
      </section>
    </div>
    </>
  );
}

function QuickLink({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card card-hover group flex h-full flex-col items-start gap-4 p-5 text-left active:scale-[0.98]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100 transition duration-300 group-hover:scale-105">
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold tracking-tight text-neutral-800">{label}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
      </div>
      <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
        Buka menu
        <ArrowRight size={16} />
      </div>
    </button>
  );
}

function HighlightRow({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "primary" | "success" | "warning" | "accent";
}) {
  const toneMap = {
    primary: "bg-primary-500",
    success: "bg-success-500",
    warning: "bg-warning-500",
    accent: "bg-accent-500",
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/75 px-4 py-3 shadow-soft">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneMap[tone]}`} />
        <span className="truncate text-sm font-medium text-neutral-500">{title}</span>
      </div>
      <span className="text-sm font-semibold text-neutral-800">{value}</span>
    </div>
  );
}

function ScoreChart({ scores }: { scores: { label: string; score: number }[] }) {
  const max = 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
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
      </div>

      <div className="glass-panel p-5">
        <p className="text-sm font-semibold text-neutral-700">Insight singkat</p>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Nilai terbaru membantu Anda melihat apakah pola belajar mulai stabil atau masih perlu penyesuaian.
        </p>
        <div className="mt-5 rounded-2xl bg-white/80 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Nilai terbaik</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {Math.max(...scores.map((item) => item.score))}%
          </p>
        </div>
      </div>
    </div>
  );
}


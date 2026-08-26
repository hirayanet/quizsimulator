/**
 * GeminiSetupModal.tsx
 * --------------------
 * Muncul otomatis setelah login pertama kali jika user belum punya API key.
 * Memandu user step-by-step untuk mendapatkan dan memasukkan API key mereka.
 */

import { useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, Key, Sparkles, ArrowRight, Copy, CheckCheck, BookOpen } from "lucide-react";
import { saveCohereKey } from "../lib/settingsStore";
import type { User } from "../types";

interface Props {
  user: User;
  onComplete: () => void; // dipanggil setelah key berhasil disimpan
  onSkip: () => void;     // lewati dulu, bisa diset nanti di Profil
}

export default function GeminiSetupModal({ user, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://dashboard.cohere.com/api-keys");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (trimmed.length < 20) {
      setError("API key terlalu pendek. Pastikan Anda menyalin key yang lengkap.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      saveCohereKey(user.id, trimmed);
      setStep(3);
    } catch {
      setError("Gagal menyimpan. Pastikan koneksi internet stabil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-md" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">

        {/* ─── STEP 1: Sambutan & penjelasan ─── */}
        {step === 1 && (
          <div className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-float">
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-600 via-primary-500 to-accent-400 text-white shadow-glow">
                <BookOpen size={28} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                Selamat datang, {user.username.split(" ")[0]}! 👋
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Untuk menghasilkan soal quiz yang akurat dan natural, aplikasi ini membutuhkan
                <span className="font-semibold text-primary-600"> API Key</span> milik Anda.
              </p>
            </div>

            {/* Benefit list */}
            <div className="mb-6 space-y-3 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 p-4">
              {[
                "Soal quiz dibuat otomatis — bukan copy-paste",
                "Pilihan jawaban rapi, konsisten & masuk akal",
                "Gratis untuk penggunaan normal (free tier Cohere)",
                "Key Anda aman — hanya disimpan di perangkat ini",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span className="text-xs font-medium text-neutral-700">{item}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={() => setStep(2)}
              className="btn-primary w-full"
            >
              Setup Sekarang <ArrowRight size={16} />
            </button>
            <button
              onClick={onSkip}
              className="mt-3 w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-600 transition"
            >
              Lewati dulu, setup nanti di Profil →
            </button>
          </div>
        )}

        {/* ─── STEP 2: Panduan & input key ─── */}
        {step === 2 && (
          <div className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-float">
            <div className="mb-5">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">2</div>
                <h2 className="text-base font-bold text-neutral-800">Dapatkan API Key</h2>
              </div>
              <p className="ml-8 text-xs text-neutral-500">Ikuti langkah berikut — hanya butuh ~2 menit</p>
            </div>

            {/* Steps */}
            <div className="mb-5 space-y-3">
              {[
                {
                  n: 1,
                  text: "Buka Dashboard Cohere",
                  sub: "dashboard.cohere.com/api-keys",
                  action: (
                    <div className="mt-2 flex gap-2">
                      <a
                        href="https://dashboard.cohere.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition"
                      >
                        Buka <ExternalLink size={11} />
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition"
                      >
                        {copied ? <><CheckCheck size={11} className="text-success-600" /> Disalin!</> : <><Copy size={11} /> Salin link</>}
                      </button>
                    </div>
                  ),
                },
                {
                  n: 2,
                  text: "Login atau Daftar akun",
                  sub: "Gunakan akun Google atau email Anda",
                },
                {
                  n: 3,
                  text: "Copy Trial Key",
                  sub: "Copy key yang muncul (Trial Key gratis)",
                },
              ].map(({ n, text, sub, action }) => (
                <div key={n} className="flex gap-3 rounded-2xl bg-neutral-50 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {n}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{text}</p>
                    <p className="text-xs text-neutral-500">{sub}</p>
                    {action}
                  </div>
                </div>
              ))}
            </div>

            {/* Input key */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                <Key size={13} /> Paste API Key di sini:
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  className="input pr-10 font-mono text-sm"
                  placeholder="Paste Trial Key Cohere..."
                  value={keyInput}
                  onChange={(e) => { setKeyInput(e.target.value); setError(null); }}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {error && <p className="text-xs text-error-600">{error}</p>}

              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim() || saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                {saving ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Menyimpan...</>
                ) : (
                  <><Check size={16} /> Simpan & Lanjutkan</>
                )}
              </button>
              <button
                onClick={onSkip}
                className="w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-600 transition"
              >
                Lewati dulu →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Sukses ─── */}
        {step === 3 && (
          <div className="rounded-[2rem] border border-white/70 bg-white/95 p-8 text-center shadow-float">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
              <Check size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Siap digunakan! 🎉</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              API Key berhasil disimpan. Sekarang quiz Anda akan dibuat secara cerdas dan otomatis.
            </p>
            <div className="mt-6 rounded-2xl bg-success-50 border border-success-100 p-3 text-xs text-success-700">
              ✅ Key tersimpan dengan aman di browser perangkat ini
            </div>
            <button
              onClick={onComplete}
              className="btn-primary mt-5 w-full"
            >
              Mulai Buat Quiz <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

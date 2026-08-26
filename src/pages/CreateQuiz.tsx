import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Music,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { createMaterial } from "../lib/db";
import { extractTextFromFile, initialProcessSteps, type ProcessStep } from "../lib/fileProcessing";
import { getFileKind, formatFileSize, isSupportedFile } from "../lib/utils";
import PageHeader from "../components/PageHeader";
import { Toast } from "../components/Toast";

export default function CreateQuiz() {
  const { user } = useUser();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessStep[]>(initialProcessSteps);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const updateStep = useCallback((stepId: string, status: ProcessStep["status"]) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setFile(f);

    if (!isSupportedFile(f)) {
      const msg = `Format file tidak didukung (${f.name} - ${f.type || 'unknown type'}). Gunakan PDF atau DOCX.`;
      alert("Debug Error: " + msg);
      setError(msg);
      setFile(null);
      return;
    }

    if (f.size > 50 * 1024 * 1024) {
      setError("File terlalu besar. Maksimal 50 MB.");
      setFile(null);
      return;
    }

    setProcessing(true);
    setSteps(initialProcessSteps.map((s) => ({ ...s, status: "pending" })));
    setProgress(10);

    try {
      const text = await extractTextFromFile(f, updateStep);
      setProgress(70);

      if (!user) {
        setError("Sesi pengguna tidak ditemukan. Silakan masukkan nama kembali.");
        setProcessing(false);
        return;
      }

      const kind = getFileKind(f);
      const material = await createMaterial(
        user.id,
        f.name,
        kind,
        f.size,
        text,
        "ready",
      );

      setProgress(100);
      updateStep("prepare", "done");

      // Small delay so user sees completion
      setTimeout(() => {
        navigate(`/quiz/config/${material.id}`);
      }, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses file.";
      alert("Debug Processing Error: " + msg);
      setError(msg);
      setFile(null);
      setProcessing(false);
    }
  }, [user, updateStep, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      alert(`Debug: File dipilih. Nama: ${f.name}, Tipe: ${f.type}, Ukuran: ${f.size} bytes`);
      handleFile(f);
    } else {
      alert("Debug: Tidak ada file yang terdeteksi dari picker.");
    }
    e.target.value = ""; // Reset agar file yang sama bisa dipilih lagi jika sebelumnya gagal
  };

  const fileIcon = file ? getFileKind(file) : null;
  const formats = [
    { label: "PDF", description: "Dokumen teks", icon: FileText },
    { label: "DOC / DOCX", description: "Materi tertulis", icon: FileText },
    { label: "Audio", description: "Belum aktif", icon: Music },
    { label: "Video", description: "Belum aktif", icon: Video },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader
        title="Buat Quiz Baru"
        subtitle="Upload materi, lalu lanjutkan ke konfigurasi quiz dengan tampilan yang lebih rapi."
        backTo="/"
      />

      <section className="card-elevated relative mb-6 overflow-hidden p-6 sm:p-7">
        <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-primary-200/50 blur-3xl" />
        <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-accent-200/50 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="badge-soft mb-4">
              <Sparkles size={14} />
              Generator quiz
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              Mulai dari materi yang Anda punya.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              Sistem akan membaca isi file, menyiapkan materi, lalu membawa Anda ke tahap konfigurasi quiz. Untuk saat ini, PDF dan DOCX adalah format yang paling siap dipakai.
            </p>
          </div>

          <div className="glass-panel p-5">
            <p className="section-title !mb-2">Pengguna aktif</p>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white">
                {user?.username?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-700">{user?.username || "Tamu"}</p>
                <p className="text-xs text-neutral-400">Peserta quiz aktif</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <InfoRow label="Ukuran maksimal" value="50 MB" />
              <InfoRow label="Format terbaik" value="PDF, DOCX" />
              <InfoRow label="Transkripsi media" value="Belum tersedia" />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-5">
          <Toast message={error} type="error" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-5">
          {!processing && (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`card-elevated relative block cursor-pointer border-2 border-dashed p-8 text-center transition duration-300 ${
                dragOver
                  ? "border-primary-400 bg-primary-50/70"
                  : "border-neutral-300/80 hover:-translate-y-1 hover:border-primary-300 hover:bg-white"
              }`}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-glow">
                <Upload size={28} />
              </div>
              <p className="mb-2 text-xl font-bold tracking-tight text-neutral-800">
                Tarik file ke sini atau tap untuk memilih
              </p>
              <p className="mx-auto max-w-lg text-sm leading-6 text-neutral-500">
                Format yang tersedia: PDF, DOC, DOCX. Untuk hasil terbaik, gunakan dokumen yang benar-benar memiliki teks.
              </p>
              <div className="btn-primary mt-5 inline-flex pointer-events-none">
                Pilih File
              </div>
              
              {/* Native label behavior ensures file picker works perfectly on all mobile OS */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleInputChange}
              />
            </label>
          )}

          {file && (
            <div className="card-elevated animate-fade-in p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100">
                  {fileIcon === "pdf" || fileIcon === "doc" || fileIcon === "docx" ? (
                    <FileText size={24} />
                  ) : fileIcon === "audio" ? (
                    <Music size={24} />
                  ) : fileIcon === "video" ? (
                    <Video size={24} />
                  ) : (
                    <FileText size={24} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-neutral-800">{file.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatFileSize(file.size)} · {fileIcon?.toUpperCase()}
                  </p>
                </div>
                <div className="badge-soft">{progress}%</div>
              </div>

              {processing && (
                <>
                  <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
                    <div
                      className="progress-fill h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    {steps.map((step) => (
                      <div key={step.id} className="flex items-center gap-3 rounded-2xl bg-neutral-50/90 px-4 py-3">
                        {step.status === "done" ? (
                          <CheckCircle2 size={18} className="text-success-500" />
                        ) : step.status === "active" ? (
                          <Loader2 size={18} className="animate-spin text-primary-500" />
                        ) : (
                          <div className="h-[18px] w-[18px] rounded-full border-2 border-neutral-200" />
                        )}
                        <span
                          className={`text-sm ${
                            step.status === "done"
                              ? "text-neutral-600"
                              : step.status === "active"
                                ? "font-medium text-neutral-800"
                                : "text-neutral-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {error && !processing && (
            <div className="rounded-3xl border border-warning-200 bg-warning-50/90 px-4 py-4 text-sm text-warning-700 shadow-soft">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>
                  Tips: Pastikan file tidak rusak dan berisi teks yang dapat dibaca. Untuk PDF hasil scan, teks mungkin tidak dapat diekstrak.
                </span>
              </div>
            </div>
          )}

          {processing && (
            <button
              onClick={() => navigate("/")}
              className="btn-ghost w-full"
            >
              Batal
            </button>
          )}
        </section>

        <aside className="space-y-4">
          <div className="glass-panel p-5">
            <p className="section-title !mb-3">Format yang didukung</p>
            <div className="space-y-3">
              {formats.map((fmt) => (
                <div key={fmt.label} className="flex items-center gap-3 rounded-2xl bg-white/75 px-4 py-3 shadow-soft">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100">
                    <fmt.icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">{fmt.label}</p>
                    <p className="text-xs text-neutral-400">{fmt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title !mb-3">Alur proses</p>
            <div className="space-y-3">
              {initialProcessSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-700">{step.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-neutral-400">
                      {index === 0
                        ? "File diterima dan diperiksa formatnya."
                        : index === 1
                          ? "Isi materi dibaca dari dokumen yang Anda unggah."
                          : index === 2
                            ? "Materi dianalisis sebelum jadi bahan soal."
                            : "Anda diarahkan ke konfigurasi quiz."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-4 py-3 shadow-soft">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-semibold text-neutral-800">{value}</span>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { useUser } from "../context/UserContext";
import { createMaterial } from "../lib/db";
import { extractTextFromFile, initialProcessSteps, type ProcessStep } from "../lib/fileProcessing";
import { getFileKind, formatFileSize, isSupportedFile } from "../lib/utils";
import PageHeader from "../components/PageHeader";
import { useToastHelpers } from "../context/ToastContext";
import { useHaptic } from "../hooks/useHaptic";

export default function CreateQuiz() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { toastError, toastSuccess } = useToastHelpers();
  const { light, success, error: errorHaptic } = useHaptic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessStep[]>(initialProcessSteps);
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  const updateStep = useCallback((stepId: string, status: ProcessStep["status"]) => {
    setSteps((prev) => {
      const newSteps = prev.map((s) => (s.id === stepId ? { ...s, status } : s));
      // Hitung progress otomatis dari status step
      const total = newSteps.length;
      const doneCount = newSteps.filter((s) => s.status === "done").length;
      const activeCount = newSteps.filter((s) => s.status === "active").length;
      const computed = Math.round(((doneCount + activeCount * 0.5) / total) * 90) + 10; // 10-100
      setProgress(computed);
      light();
      return newSteps;
    });
  }, [light]);

  // ETA calculator
  useEffect(() => {
    if (!processing || progress >= 100) {
      setEtaSeconds(null);
      return;
    }
    const interval = setInterval(() => {
      if (startedAt && progress > 10) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = (progress - 10) / elapsed; // %/s
        const remaining = rate > 0 ? Math.round((100 - progress) / rate) : null;
        setEtaSeconds(remaining);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [processing, progress, startedAt]);

  const handleFile = useCallback(async (f: File) => {
    if (!isSupportedFile(f)) {
      toastError(`Format tidak didukung: ${f.name}. Gunakan PDF atau DOCX.`);
      errorHaptic();
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toastError("File terlalu besar. Maksimal 50 MB.");
      errorHaptic();
      return;
    }

    setFile(f);
    setProcessing(true);
    setSteps(initialProcessSteps.map((s) => ({ ...s, status: "pending" })));
    setProgress(10);
    setStartedAt(Date.now());
    setEtaSeconds(null);

    try {
      const text = await extractTextFromFile(f, updateStep);
      setProgress(70);

      if (!user) {
        toastError("Sesi tidak ditemukan. Masukkan nama kembali.");
        setProcessing(false);
        return;
      }

      const kind = getFileKind(f);
      const material = await createMaterial(user.id, f.name, kind, f.size, text, "ready");

      setProgress(100);
      updateStep("prepare", "done");
      toastSuccess("Materi siap!");
      success();

      setTimeout(() => navigate(`/quiz/config/${material.id}`), 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memproses file.";
      toastError(msg);
      errorHaptic();
      setFile(null);
      setProcessing(false);
    }
  }, [user, updateStep, navigate, toastError, toastSuccess, success, errorHaptic]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    setSteps(initialProcessSteps);
  };

  const fileIcon = file ? getFileKind(file) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title="Buat Quiz Baru" backTo="/" />

      {/* Upload Zone — Main Focus */}
      <section className="space-y-5">
        {!file ? (
          // Empty state - drag & drop zone
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            className={`card-elevated relative block cursor-pointer border-2 border-dashed p-10 text-center transition duration-300 ${
              dragOver
                ? "border-primary-400 bg-primary-50/70 scale-[1.01] shadow-glow"
                : "border-neutral-300/80 hover:-translate-y-1 hover:border-primary-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-glow">
              <Upload size={32} />
            </div>
            <p className="mb-1 text-2xl font-bold tracking-tight text-neutral-800">
              Tarik file ke sini atau tap untuk pilih
            </p>
            <p className="mx-auto max-w-md text-sm text-neutral-500">
              PDF, DOC, DOCX · Maks 50 MB
            </p>

            {/* Hidden file input — sr-only ensures mobile browsers can reliably open the file picker via ref.click() */}
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleInputChange}
              aria-label="Pilih file PDF atau DOCX"
            />
          </label>
        ) : (
          // File selected - show progress
          <div className="card-elevated animate-fade-in p-6 space-y-5">
            {/* File info row */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100">
                {fileIcon === "pdf" || fileIcon === "doc" || fileIcon === "docx" ? (
                  <FileText size={24} />
                ) : (
                  <FileText size={24} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-800">{file.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={removeFile}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition"
                aria-label="Hapus file"
              >
                <X size={18} />
              </button>
            </div>

            {/* Progress bar with percentage + ETA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-neutral-600">
                  {progress < 100 ? (
                    <>Memproses<span className="ml-1 inline-block animate-pulse">…</span></>
                  ) : (
                    <span className="text-success-600">Selesai</span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-neutral-500">
                  {etaSeconds !== null && progress < 100 && (
                    <span>± {etaSeconds < 60 ? `${etaSeconds}d` : `${Math.ceil(etaSeconds / 60)}m`}</span>
                  )}
                  <span className="font-bold text-neutral-700">{progress}%</span>
                </span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
                <div
                  className="progress-fill h-full rounded-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400 relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  {progress < 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  )}
                </div>
                {/* Center percentage overlay */}
                {progress >= 15 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-neutral-700 mix-blend-difference">
                    {progress}%
                  </span>
                )}
              </div>
            </div>

            {/* Processing steps */}
            {processing && (
              <div className="space-y-2.5 border-t border-neutral-100 pt-4">
                {steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 text-sm">
                    {step.status === "done" ? (
                      <CheckCircle2 size={16} className="text-success-500 shrink-0" />
                    ) : step.status === "active" ? (
                      <Loader2 size={16} className="animate-spin text-primary-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 shrink-0 rounded-full border-2 border-neutral-200" />
                    )}
                    <span className={`flex-1 truncate ${
                      step.status === "done" ? "text-neutral-500"
                      : step.status === "active" ? "font-medium text-neutral-800"
                      : "text-neutral-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Cancel button while processing */}
            {processing && (
              <button
                onClick={() => { setProcessing(false); setFile(null); setProgress(0); setSteps(initialProcessSteps); }}
                className="btn-ghost w-full"
              >
                Batal
              </button>
            )}
          </div>
        )}
      </section>

      {/* Minimal hint */}
      <p className="mt-6 text-center text-xs text-neutral-400">
        Untuk hasil terbaik, gunakan dokumen dengan teks yang bisa dipilih (bukan scan gambar).
      </p>
    </div>
  );
}
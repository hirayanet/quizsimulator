import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useUser } from "../context/UserContext";
import { createMaterial } from "../lib/db";
import { extractTextFromFile, initialProcessSteps, type ExtractionCheckpoint, type ProcessStep } from "../lib/fileProcessing";
import { beginPendingUpload, clearPendingUpload, getCachedExtraction, getPendingUpload, saveCachedExtraction, savePendingProgress, type PendingUpload } from "../lib/uploadSession";
import { getFileKind, formatFileSize, isSupportedFile } from "../lib/utils";
import PageHeader from "../components/PageHeader";
import { useToastHelpers } from "../context/ToastContext";
import { useHaptic } from "../hooks/useHaptic";

// ─── Vanilla DOM Overlay Helpers ────────────────────────────────────────────
// Di mobile, PDF.js memblok main thread sehingga React tidak bisa re-render.
// Overlay ini dibuat langsung di DOM agar muncul INSTAN dan tetap tampil
// sepanjang proses, memperbarui teksnya di setiap tahap.

const OVERLAY_ID = "__mobile_file_overlay__";

function createOrUpdateOverlay(title: string, subtitle: string) {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      "position:fixed", "inset:0", "z-index:9999",
      "display:flex", "flex-direction:column", "align-items:center",
      "justify-content:center", "gap:24px",
      "background:rgba(255,255,255,0.96)",
      "-webkit-backdrop-filter:blur(8px)", "backdrop-filter:blur(8px)",
    ].join(";");
    overlay.innerHTML = `
      <div id="${OVERLAY_ID}_icon" style="width:80px;height:80px;border-radius:24px;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 36px rgba(99,102,241,0.4)">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          style="animation:${OVERLAY_ID}_spin 0.85s linear infinite;transform-origin:center">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
      <div style="text-align:center;padding:0 32px">
        <p id="${OVERLAY_ID}_title" style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px;line-height:1.3"></p>
        <p id="${OVERLAY_ID}_subtitle" style="font-size:13px;color:#6b7280;margin:0;line-height:1.5"></p>
      </div>
      <style>@keyframes ${OVERLAY_ID}_spin { to { transform: rotate(360deg) } }</style>
    `;
    document.body.appendChild(overlay);
  }
  const t = document.getElementById(`${OVERLAY_ID}_title`);
  const s = document.getElementById(`${OVERLAY_ID}_subtitle`);
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

function showSuccessOverlay() {
  const icon = document.getElementById(`${OVERLAY_ID}_icon`);
  if (icon) {
    icon.style.background = "linear-gradient(135deg,#16a34a 0%,#22c55e 100%)";
    icon.style.boxShadow = "0 0 36px rgba(34,197,94,0.4)";
    icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  }
  const t = document.getElementById(`${OVERLAY_ID}_title`);
  const s = document.getElementById(`${OVERLAY_ID}_subtitle`);
  if (t) t.textContent = "Materi Berhasil Diupload ✓";
  if (s) s.textContent = "Mengalihkan ke konfigurasi quiz…";
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

/** Perbarui hanya baris subtitle overlay (dipakai untuk progres detail halaman) */
function updateOverlaySubtitle(subtitle: string) {
  const el = document.getElementById(`${OVERLAY_ID}_subtitle`);
  if (el) el.textContent = subtitle;
}

/** Deteksi error pembatalan (AbortError standar atau AbortException dari PDF.js) */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  const name = (err as { name?: string } | null)?.name;
  return name === "AbortError" || name === "AbortException";
}

// Peta stepId_status → [title, subtitle] untuk update overlay
// (hanya langkah yang benar-benar terjadi saat upload — tanpa langkah kosmetik palsu)
const STEP_OVERLAY_TEXT: Record<string, [string, string]> = {
  "read_active": ["Membaca Materi…", "Mengekstrak teks dari file Anda"],
  "save_active": ["Menyimpan Materi…", "Menghubungi server…"],
};
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateQuiz() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { toastError } = useToastHelpers();
  const { light, success, error: errorHaptic } = useHaptic();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState<ProcessStep[]>(initialProcessSteps);
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  // Upload yang terhenti (layar terkunci → tab di-reload) dan bisa dilanjutkan
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  // Penanda bahwa proses dibatalkan / komponen di-unmount → jangan lanjut ke pembuatan materi
  const cancelledRef = useRef(false);
  // Kontrol pembatalan ekstraksi file (AbortController) — benar-benar menghentikan proses
  const abortRef = useRef<AbortController | null>(null);

  // Muat sesi upload yang terhenti (jika ada) saat halaman dibuka
  useEffect(() => {
    let cancelled = false;
    getPendingUpload().then((pending) => {
      if (!cancelled && pending) setPendingUpload(pending);
    });
    return () => { cancelled = true; };
  }, []);

  // Bersihkan overlay, tandai batal, dan hentikan ekstraksi saat komponen unmount
  useEffect(() => {
    return () => { removeOverlay(); cancelledRef.current = true; abortRef.current?.abort(); };
  }, []);

  const updateStep = useCallback((stepId: string, status: ProcessStep["status"]) => {
    // Update vanilla overlay teks (mobile utama)
    const key = `${stepId}_${status}`;
    if (STEP_OVERLAY_TEXT[key]) {
      const [title, subtitle] = STEP_OVERLAY_TEXT[key];
      createOrUpdateOverlay(title, subtitle);
    }
    // Update React state juga (untuk desktop)
    setSteps((prev) => {
      const newSteps = prev.map((s) => (s.id === stepId ? { ...s, status } : s));
      const total = newSteps.length;
      const doneCount = newSteps.filter((s) => s.status === "done").length;
      const activeCount = newSteps.filter((s) => s.status === "active").length;
      const computed = Math.round(((doneCount + activeCount * 0.5) / total) * 90) + 10;
      setProgress(computed);
      light();
      return newSteps;
    });
  }, [light]);

  // ETA calculator
  useEffect(() => {
    if (!processing || progress >= 100) { setEtaSeconds(null); return; }
    const interval = setInterval(() => {
      if (startedAt && progress > 10) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = (progress - 10) / elapsed;
        setEtaSeconds(rate > 0 ? Math.round((100 - progress) / rate) : null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [processing, progress, startedAt]);

  const handleFile = useCallback(async (f: File, checkpoint?: ExtractionCheckpoint | null) => {
    if (!isSupportedFile(f)) {
      removeOverlay();
      toastError(`Format tidak didukung: ${f.name}. Gunakan PDF atau DOCX.`);
      errorHaptic();
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      removeOverlay();
      toastError("File terlalu besar. Maksimal 50 MB.");
      errorHaptic();
      return;
    }

    cancelledRef.current = false;
    // Batalkan proses lama (jika masih berjalan) dan siapkan kontrol pembatalan baru
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Overlay sudah tampil dari input.onchange — perbarui ke teks proses awal
    createOrUpdateOverlay("Memuat File…", "Sedang menyiapkan file Anda");

    const kind = getFileKind(f);

    setFile(f);
    setProcessing(true);
    setSteps(initialProcessSteps.map((s) => ({ ...s, status: "pending" })));
    setProgress(10);
    setDetail(null);
    setStartedAt(Date.now());
    setEtaSeconds(null);

    // Simpan sesi SEBELUM ekstraksi — jika tab di-reload, user bisa melanjutkan
    await beginPendingUpload(f, kind);

    // Cache hasil ekstraksi: file identik yang diupload ulang langsung lompat
    // ke penyimpanan (tanpa membaca/OCR ulang). Signature = ukuran + tanggal + nama.
    const cacheSignature = `${f.size}-${f.lastModified}-${f.name}`;
    const cachedText = await getCachedExtraction(cacheSignature);

    try {
      let text: string;
      if (cachedText !== null) {
        // File pernah diekstrak sebelumnya — pakai hasilnya, tanpa proses ulang
        updateStep("read", "done");
        text = cachedText;
      } else {
        text = await extractTextFromFile(
          f,
          updateStep,
          (msg) => {
            setDetail(msg);
            updateOverlaySubtitle(msg);
          },
          // Simpan progres per halaman ke IndexedDB agar bisa dilanjutkan
          (cp, totalPages) => {
            savePendingProgress(cp.savedPages, cp.scannedPages, totalPages);
          },
          checkpoint,
          controller.signal,
        );
        // Simpan ke cache agar upload ulang file yang sama menjadi instan
        saveCachedExtraction(cacheSignature, text);
      }
      if (cancelledRef.current) return;
      setProgress(70);
      setDetail(null);

      if (!user) {
        removeOverlay();
        toastError("Sesi tidak ditemukan. Masukkan nama kembali.");
        setProcessing(false);
        return;
      }

      // Mulai penyimpanan materi ke database (overlay diperbarui via updateStep)
      updateStep("save", "active");
      const material = await createMaterial(user.id, f.name, kind, f.size, text, "ready");
      if (cancelledRef.current) return;

      updateStep("save", "done");
      setProgress(100);

      // Sukses — hapus sesi yang tersimpan agar tidak ditawarkan lagi
      await clearPendingUpload();

      // Tampilkan ikon centang hijau di overlay agar user tahu sukses
      // (tanpa toast — toast akan menempel di halaman konfigurasi quiz
      //  dan terlihat seperti notifikasi yang muncul saat generate soal)
      showSuccessOverlay();
      success();

      // Hapus overlay lalu navigasi setelah user sempat melihat ikon sukses
      setTimeout(() => {
        if (cancelledRef.current) return;
        removeOverlay();
        navigate(`/quiz/config/${material.id}`);
      }, 900);
    } catch (err) {
      // Jika dibatalkan pengguna (tombol Batal / keluar halaman): bersihkan tanpa toast error
      if (cancelledRef.current || isAbortError(err)) {
        await clearPendingUpload();
        removeOverlay();
        setFile(null);
        setProcessing(false);
        setProgress(0);
        setSteps(initialProcessSteps);
        setDetail(null);
        return;
      }
      await clearPendingUpload();
      removeOverlay();
      const msg = err instanceof Error ? err.message : "Gagal memproses file.";
      toastError(msg);
      errorHaptic();
      setFile(null);
      setProcessing(false);
    }
  }, [user, updateStep, navigate, toastError, success, errorHaptic]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const removeFile = () => {
    abortRef.current?.abort();
    cancelledRef.current = true;
    clearPendingUpload();
    setFile(null);
    setProgress(0);
    setSteps(initialProcessSteps);
  };

  const discardPendingUpload = () => {
    abortRef.current?.abort();
    cancelledRef.current = true;
    clearPendingUpload();
    setPendingUpload(null);
  };

  const resumePendingUpload = () => {
    if (!pendingUpload) return;
    const f = pendingUpload.file;
    const checkpoint: ExtractionCheckpoint = {
      savedPages: pendingUpload.savedPages,
      scannedPages: pendingUpload.scannedPages,
    };
    setPendingUpload(null);
    handleFile(f, checkpoint);
  };

  const pendingDoneCount = pendingUpload ? Object.keys(pendingUpload.savedPages).length : 0;
  const pendingProgressText = pendingUpload?.totalPages
    ? ` Sudah diproses ${pendingDoneCount} dari ${pendingUpload.totalPages} halaman — lanjut dari sini, tidak perlu mulai dari nol.`
    : " Proses baru saja dimulai — bisa langsung dilanjutkan dari awal file.";

  const fileIcon = file ? getFileKind(file) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title="Buat Quiz Baru" backTo="/" />

      <section className="space-y-5">
        {!file && !pendingUpload ? (
          // Empty state - drag & drop zone
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
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

            {/* NATIVE DOM INPUT MOUNT — wajib untuk Chrome Android / WebViews */}
            <div ref={(el) => {
              if (el && !el.querySelector("input")) {
                const input = document.createElement("input");
                input.type = "file";
                input.style.display = "none";
                input.accept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  const f = target.files?.[0];
                  if (f) {
                    // Tampilkan overlay SEKETIKA sebelum handleFile dipanggil
                    createOrUpdateOverlay("Memuat File…", "Sedang menyiapkan file Anda");
                    handleFile(f);
                    target.value = "";
                  }
                };
                el.appendChild(input);
              }
            }} />
          </label>
        ) : !file && pendingUpload ? (
          // Upload terhenti (layar terkunci / tab ditutup) — tawarkan melanjutkan
          <div className="card-elevated animate-fade-in p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber-50 to-white text-amber-600 ring-1 ring-amber-100">
                <RotateCcw size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-800">{pendingUpload.file.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{formatFileSize(pendingUpload.file.size)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50/70 p-4 text-sm leading-5 text-neutral-600">
              <p className="mb-1 font-semibold text-neutral-800">Upload sebelumnya terhenti</p>
              <p>
                Proses berjalan saat layar terkunci atau tab ditutup, lalu browser me-reload halaman.
                {pendingProgressText}
              </p>
            </div>

            <button onClick={resumePendingUpload} className="btn-primary w-full">
              Lanjutkan Upload
            </button>
            <button onClick={discardPendingUpload} className="btn-ghost w-full">
              Batalkan &amp; Mulai Ulang
            </button>
          </div>
        ) : (
          // File selected - show React progress UI (terlihat di desktop / jika React berhasil render)
          <div className="card-elevated animate-fade-in p-6 space-y-5">
            {/* File info row */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100">
                <FileText size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-800">{file!.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{formatFileSize(file!.size)}</p>
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
                {progress >= 15 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-neutral-700 mix-blend-difference">
                    {progress}%
                  </span>
                )}
              </div>
            </div>

            {/* Detail progres (misal: halaman ke berapa) */}
            {processing && detail && (
              <p className="-mt-2 truncate text-center text-xs font-medium text-neutral-400">
                {detail}
              </p>
            )}

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

            {/* Cancel button */}
            {processing && (
              <button
                onClick={() => { abortRef.current?.abort(); cancelledRef.current = true; clearPendingUpload(); removeOverlay(); setProcessing(false); setFile(null); setProgress(0); setSteps(initialProcessSteps); setDetail(null); }}
                className="btn-ghost w-full"
              >
                Batal
              </button>
            )}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Untuk hasil terbaik, gunakan dokumen dengan teks yang bisa dipilih (bukan scan gambar).
      </p>
    </div>
  );
}
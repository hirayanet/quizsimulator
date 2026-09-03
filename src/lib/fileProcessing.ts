import { getFileKind } from "./utils";

export interface ProcessStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

export const initialProcessSteps: ProcessStep[] = [
  { id: "upload", label: "File berhasil diupload", status: "pending" },
  { id: "read", label: "Membaca materi", status: "pending" },
  { id: "save", label: "Menyimpan materi", status: "pending" },
];

/** Callback progres detail (misal: "Membaca halaman 12 dari 40…") */
export type DetailCallback = (message: string) => void;

/**
 * Checkpoint ekstraksi — halaman yang sudah selesai diproses pada sesi
 * sebelumnya (mis. saat tab di-reload karena layar HP terkunci).
 * `savedPages` memetakan indeks halaman → teks hasil ekstraksi;
 * `scannedPages` berisi indeks halaman yang tidak punya text layer (scan).
 */
export interface ExtractionCheckpoint {
  savedPages: Record<number, string>;
  scannedPages: number[];
}

/**
 * Dipanggil berkala saat ekstraksi berjalan dengan snapshot progres
 * (halaman yang sudah selesai + daftar halaman scan), agar bisa disimpan
 * ke IndexedDB dan dilanjutkan jika tab di-reload.
 */
export type CheckpointCallback = (checkpoint: ExtractionCheckpoint, totalPages: number) => void;

/**
 * Batas teks hasil ekstraksi yang disimpan:
 * - Generator AI hanya membaca ±12–15 ribu karakter awal materi.
 * - Fallback berbasis kalimat tidak membutuhkan ratusan ribu karakter.
 * Membatasi teks mencegah dokumen raksasa memperlambat penyimpanan ke DB.
 */
export const MAX_EXTRACTED_CHARS = 400_000;

export async function extractTextFromFile(
  file: File,
  onProgress?: (stepId: string, status: ProcessStep["status"]) => void,
  onDetail?: DetailCallback,
  onCheckpoint?: CheckpointCallback,
  checkpoint?: ExtractionCheckpoint | null,
): Promise<string> {
  const kind = getFileKind(file);

  onProgress?.("upload", "done");
  onProgress?.("read", "active");

  let text = "";

  try {
    if (kind === "pdf") {
      text = await extractPdfText(file, onDetail, onCheckpoint, checkpoint);
    } else if (kind === "docx" || kind === "doc") {
      text = await extractDocxText(file);
    } else if (kind === "audio" || kind === "video") {
      text = await extractMediaTranscript(file);
    } else {
      throw new Error("Format file tidak didukung.");
    }
  } catch (err) {
    onProgress?.("read", "done");
    throw err;
  }

  if (!text || text.trim().length < 20) {
    throw new Error(
      "Tidak bisa mengekstrak teks dari file ini. Pastikan file berisi teks yang dapat dibaca.",
    );
  }

  const limited = limitExtractedText(text);

  // Catatan: tidak ada langkah "Menganalisis materi" / "Menyiapkan quiz" di sini.
  // Keduanya hanya langkah kosmetik palsu (delay 600ms) yang membuat pengguna
  // mengira quiz sedang disiapkan — padahal quiz hanya dibuat di halaman
  // konfigurasi setelah tombol "Generate Quiz" ditekan.
  onProgress?.("read", "done");

  return limited;
}

interface OcrWorkerLike {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}

/**
 * Jalankan tugas berindeks 0..count-1 dengan maksimal `concurrency` tugas
 * berjalan bersamaan. Hasil disimpan sesuai urutan indeks aslinya.
 */
async function mapConcurrent<T>(
  count: number,
  concurrency: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(count);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, count));

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < count) {
        const i = next++;
        results[i] = await worker(i);
      }
    }),
  );

  return results;
}

/**
 * Jumlah halaman PDF yang boleh diproses bersamaan.
 * Dibatasi kecil: tiap halaman memakai memori & antrean worker PDF.js,
 * terlalu banyak justru memperlambat di perangkat mobile.
 */
function getConcurrency(): number {
  if (typeof navigator === "undefined") return 2;
  const hw = navigator.hardwareConcurrency || 4;
  return Math.min(3, Math.max(1, hw - 1));
}

const MIN_TEXT_CHARS = 20;

/**
 * Skala render halaman scan untuk OCR. Sebelumnya 2.0 (4× luas piksel vs 1.0);
 * 1.6 cukup akurat untuk teks cetak namun ~36% lebih cepat & hemat memori.
 */
const OCR_SCALE = 1.6;

async function extractPdfText(
  file: File,
  onDetail?: DetailCallback,
  onCheckpoint?: CheckpointCallback,
  checkpoint?: ExtractionCheckpoint | null,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Gunakan CDN untuk worker agar tidak gagal diload pada perangkat mobile (iOS/Android Safari)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;

  const pageTexts: string[] = new Array(numPages);
  // Halaman yang sudah selesai pada sesi sebelumnya (dipakai saat melanjutkan)
  const savedPages: Record<number, string> = { ...(checkpoint?.savedPages ?? {}) };
  const resuming = Object.keys(savedPages).length > 0;
  const scanSet = new Set<number>(checkpoint?.scannedPages ?? []);

  const emitCheckpoint = (totalPages: number) => {
    onCheckpoint?.({ savedPages, scannedPages: [...scanSet] }, totalPages);
  };

  // Jumlah halaman yang sudah diproses sebelumnya (indeks valid saja)
  let processed = resuming
    ? Object.keys(savedPages).filter((k) => Number(k) < numPages).length
    : 0;

  try {
    // ── Fase 1: ambil text-layer SEMUA halaman secara paralel (tanpa render) ──
    // Dokumen teks besar tidak lagi diproses halaman demi halaman berurutan,
    // sehingga waktu baca berkurang drastis (tergantung jumlah inti CPU).
    onDetail?.(
      numPages > 1
        ? `${resuming ? "Melanjutkan — " : ""}Membaca halaman ${processed} dari ${numPages}…`
        : resuming
          ? "Melanjutkan proses…"
          : "Membaca halaman…",
    );

    await mapConcurrent(numPages, getConcurrency(), async (i) => {
      // Halaman sudah selesai pada sesi sebelumnya → lewati (tidak diproses ulang)
      if (savedPages[i] !== undefined) {
        pageTexts[i] = savedPages[i];
        processed++;
        return;
      }

      const page = await pdf.getPage(i + 1);
      let pageText = "";
      try {
        const content = await page.getTextContent();
        pageText = content.items
          .map((item: unknown) => (item as { str?: string }).str || "")
          .join(" ");
      } finally {
        try {
          page.cleanup();
        } catch {
          /* abaikan */
        }
      }

      if (pageText.replace(/\s+/g, "").length > MIN_TEXT_CHARS) {
        pageTexts[i] = pageText;
        savedPages[i] = pageText;
      } else {
        // Halaman nyaris tanpa teks → kemungkinan hasil scan, tandai untuk OCR
        scanSet.add(i);
      }

      processed++;
      if (numPages > 1 && (processed % 5 === 0 || processed === numPages)) {
        onDetail?.(`Membaca halaman ${processed} dari ${numPages}…`);
        // Simpan progres agar bisa dilanjutkan jika tab tiba-tiba di-reload
        emitCheckpoint(numPages);
      }
    });

    // ── Fase 2: OCR halaman scan (berurutan, worker tunggal agar hemat memori) ──
    const scannedPages = [...scanSet].sort((a, b) => a - b);
    const remainingScans = scannedPages.filter((p) => savedPages[p] === undefined);

    if (remainingScans.length > 0) {
      // Penjelasan dua fase: "17" tadi = total halaman; angka ini = jumlah halaman scan
      onDetail?.(
        `Fase 1 selesai — ${scannedPages.length} halaman tanpa teks (scan). Mulai pengenalan teks…`,
      );

      // OCR dijalankan lazy — hanya jika ada halaman tanpa text layer (hasil scan)
      let ocrWorker: OcrWorkerLike | null = null;
      const ensureOcrWorker = async (): Promise<OcrWorkerLike | null> => {
        if (ocrWorker) return ocrWorker;
        try {
          onDetail?.("Mengunduh model bahasa untuk scan (sekali saja)…");
          const { createWorker } = await import("tesseract.js");
          ocrWorker = (await createWorker("ind")) as unknown as OcrWorkerLike;
          return ocrWorker;
        } catch {
          return null;
        }
      };

      // Mulai dari jumlah scan yang sudah selesai pada sesi sebelumnya
      let ocrDone = scannedPages.length - remainingScans.length;
      try {
        for (const i of scannedPages) {
          if (savedPages[i] !== undefined) continue; // sudah selesai OCR sebelumnya

          const worker = await ensureOcrWorker();
          if (!worker) break;

          try {
            // Tampilkan nomor scan DAN nomor halaman PDF asli agar tidak rancu
            onDetail?.(
              `Mengenali teks scan ${ocrDone + 1} dari ${scannedPages.length} (halaman PDF ${i + 1} dari ${numPages})…`,
            );
            const page = await pdf.getPage(i + 1);

            // Batasi resolusi kanvas agar halaman raksasa tidak boros memori
            const baseViewport = page.getViewport({ scale: 1 });
            const safeScale = Math.max(1, Math.min(OCR_SCALE, 1700 / baseViewport.width));
            const viewport = page.getViewport({ scale: safeScale });

            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const { data } = await worker.recognize(canvas);
              const ocrText = (data.text || "") + "\n";
              pageTexts[i] = ocrText;
              savedPages[i] = ocrText;
              // Simpan hasil OCR per halaman → bisa lanjut jika tab di-reload
              emitCheckpoint(numPages);
            }
            try {
              page.cleanup();
            } catch {
              /* abaikan */
            }
          } catch {
            // Satu halaman gagal (mis. terlalu besar) — lanjut ke halaman berikutnya
          }
          ocrDone++;
        }
      } finally {
        // Cast diperlukan: TS tidak melacak assignment di dalam closure ensureOcrWorker
        await (ocrWorker as OcrWorkerLike | null)?.terminate();
      }
    }

    // Pastikan snapshot terakhir tersimpan (mencakup kasus tanpa scan / semua selesai)
    emitCheckpoint(numPages);

    return cleanExtractedText(pageTexts.join("\n"));
  } finally {
    try {
      await pdf.destroy();
    } catch {
      /* abaikan */
    }
  }
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return cleanExtractedText(result.value);
}

async function extractMediaTranscript(file: File): Promise<string> {
  // Audio/video transcription requires a server-side API (e.g. OpenAI Whisper).
  // For MVP, we inform the user that transcription is not yet available.
  void file;
  throw new Error(
    "Transkripsi audio/video belum tersedia di versi ini. Silakan gunakan file PDF atau DOCX untuk saat ini.",
  );
}

/** Potong teks sangat panjang di batas kata terakhir sebelum MAX_EXTRACTED_CHARS */
function limitExtractedText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EXTRACTED_CHARS) return trimmed;

  const cut = trimmed.slice(0, MAX_EXTRACTED_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const base =
    lastSpace > MAX_EXTRACTED_CHARS * 0.75 ? cut.slice(0, lastSpace) : cut;
  return base.trim().replace(/[,;:.\s]+$/, "");
}

/**
 * Clean extracted text from PDF/DOCX to remove artifacts
 * like single letters, page numbers, and formatting issues
 */
function cleanExtractedText(text: string): string {
  let cleaned = text.trim();
  
  // Remove single letters at the end of lines (common PDF artifact)
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/gm, "");
  
  // Remove single letters at the end of the entire text
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/, "");
  
  // Remove common PDF artifacts like page numbers and headers
  cleaned = cleaned.replace(/^\d+\s*$/gm, ""); // Standalone numbers
  cleaned = cleaned.replace(/^Halaman\s+\d+/gim, ""); // Page headers
  
  // Remove multiple consecutive spaces
  cleaned = cleaned.replace(/\s{3,}/g, " ");
  
  // Remove empty lines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");
  
  // Remove special characters that are likely artifacts
  cleaned = cleaned.replace(/[^\w\s\.,;:!?()\-–—]/g, "");
  
  // Fix spacing around punctuation
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, "$1");
  
  return cleaned.trim();
}

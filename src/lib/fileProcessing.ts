import { getFileKind } from "./utils";

export interface ProcessStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

export const initialProcessSteps: ProcessStep[] = [
  { id: "upload", label: "File berhasil diupload", status: "pending" },
  { id: "read", label: "Membaca materi", status: "pending" },
  { id: "analyze", label: "Menganalisis materi", status: "pending" },
  { id: "prepare", label: "Menyiapkan quiz", status: "pending" },
];

export async function extractTextFromFile(
  file: File,
  onProgress?: (stepId: string, status: ProcessStep["status"]) => void,
): Promise<string> {
  const kind = getFileKind(file);

  onProgress?.("upload", "done");
  onProgress?.("read", "active");

  let text = "";

  try {
    if (kind === "pdf") {
      text = await extractPdfText(file);
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

  onProgress?.("read", "done");
  onProgress?.("analyze", "active");
  await delay(600);
  onProgress?.("analyze", "done");
  onProgress?.("prepare", "active");

  return text.trim();
}

interface OcrWorkerLike {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker via Vite
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  // OCR dijalankan lazy — hanya jika ada halaman tanpa text layer (hasil scan)
  let ocrWorker: OcrWorkerLike | null = null;
  const ensureOcrWorker = async (): Promise<OcrWorkerLike | null> => {
    if (ocrWorker) return ocrWorker;
    try {
      const { createWorker } = await import("tesseract.js");
      ocrWorker = (await createWorker("ind")) as unknown as OcrWorkerLike;
      return ocrWorker;
    } catch {
      return null;
    }
  };

  try {
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => (item as { str?: string }).str || "")
        .join(" ");

      if (pageText.replace(/\s+/g, "").length > 20) {
        text += pageText + "\n";
        continue;
      }

      // Halaman nyaris tanpa teks → kemungkinan hasil scan, jalankan OCR
      const worker = await ensureOcrWorker();
      if (!worker) {
        text += pageText + "\n";
        continue;
      }

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        text += pageText + "\n";
        continue;
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      text += (data.text || "") + "\n";
    }
    return cleanExtractedText(text);
  } finally {
    const worker = ocrWorker as OcrWorkerLike | null;
    await worker?.terminate();
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

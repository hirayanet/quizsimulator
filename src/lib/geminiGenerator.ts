/**
 * geminiGenerator.ts
 * -------------------
 * Menggunakan Google Gemini API untuk menghasilkan soal quiz berkualitas tinggi
 * dari materi yang diupload user.
 *
 * Alur:
 * 1. Materi dikirim ke Gemini dengan prompt terstruktur (Bahasa Indonesia)
 * 2. Gemini menghasilkan soal, pilihan jawaban, jawaban benar, dan penjelasan
 * 3. Response JSON di-parse dan dikembalikan sebagai GeneratedQuestion[]
 */

import type { QuizConfig } from "../types";
import type { GeneratedQuestion } from "./quizGenerator";
import { fingerprintQuestion } from "./quizGenerator";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Batas karakter materi yang dikirim ke Gemini (hemat token, cukup informatif)
const MAX_MATERIAL_CHARS = 12000;

let cachedGeminiModels: string[] | null = null;
let cachedGeminiModel: string | null = null;

export async function getGeminiModelsList(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`${GEMINI_MODELS_URL}?key=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    const models = data.models as Array<{ name: string; supportedGenerationMethods: string[] }>;
    
    // Ambil model yang mensupport generateContent dan filter versi lama
    return models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name) // name format is "models/gemini-1.5-flash"
      .filter(name => name.includes("gemini"))
      .sort();
  } catch (err) {
    console.error("Failed to fetch Gemini models list:", err);
    return [];
  }
}

async function getAvailableGeminiModel(apiKey: string): Promise<string> {
  if (cachedGeminiModel) return cachedGeminiModel;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${GEMINI_MODELS_URL}?key=${apiKey}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error("Failed to fetch models");
    
    const data = await res.json();
    const models = data.models as Array<{ name: string; supportedGenerationMethods: string[] }>;
    
    const textModels = models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name);
      
    if (textModels.length > 0) {
      // Prioritaskan gemini-3.6-flash, gemini-3.0-flash, lalu gemini-2.5-flash
      const best = 
        textModels.find(m => m.includes("gemini-3.6-flash")) ||
        textModels.find(m => m.includes("gemini-3.0-flash")) ||
        textModels.find(m => m.includes("gemini-2.5-flash")) ||
        textModels.find(m => m.includes("gemini-2.0-flash")) ||
        textModels.find(m => m.includes("gemini-1.5-flash")) ||
        textModels[0];
        
      cachedGeminiModel = best;
      return best;
    }
    
    return "models/gemini-3.6-flash"; // Fallback default API saat ini
  } catch (error) {
    console.warn("[Gemini] Auto-discovery failed, using fallback.");
    return "models/gemini-3.6-flash";
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: { message: string; code: number };
}

interface RawQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

/**
 * Bangun prompt terstruktur untuk Gemini.
 * Prompt dirancang supaya output soal:
 * - Natural dalam Bahasa Indonesia
 * - Pilihan jawaban seragam panjang & format
 * - Pengecoh yang plausible (masuk akal, bukan asal comot)
 * - Penjelasan yang informatif
 */
function buildPrompt(
  materialText: string,
  config: QuizConfig,
  totalQuestions: number,
): string {
  const difficultyDesc: Record<string, string> = {
    mudah: "mudah — fokus pada fakta utama dan definisi dasar",
    sedang:
      "sedang — memerlukan pemahaman konsep dan kemampuan menganalisis",
    sulit:
      "sulit — memerlukan analisis mendalam, sintesis, atau evaluasi konsep",
    campuran: "campuran — variasikan antara mudah, sedang, dan sulit secara merata",
  };

  const difficulty = difficultyDesc[config.difficulty] || "sedang";
  const numOptions = config.numberOfOptions;
  const optionLabels = ["A", "B", "C", "D", "E"].slice(0, numOptions);

  // Potong materi agar tidak melebihi batas token
  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) +
        "\n\n[...materi dipotong untuk efisiensi...]"
      : materialText;

  return `Kamu adalah guru profesional yang kreatif dalam membuat soal ujian. Target: buat soal yang menantang, variatif, dan tidak membosankan.

Tugas: Buat TEPAT ${totalQuestions} soal pilihan ganda berdasarkan RANGKUMAN POIN PENTING di bawah.

PRINSIP UTAMA:
- Materi di bawah adalah RANGKUMAN POIN PENTING, bukan teks mentah.
- Buat soal dari pemahaman poin-poin penting ini, bukan dari kalimat mentah.
- Fokus pada MAKNA dan KONSEP, bukan pada kata-kata persis.
- Jawaban boleh di-rephrase secara kreatif selama maknanya sesuai dengan poin penting.
- Buat soal dari SCRATCH dengan bahasa yang baik, jelas, dan terstruktur.
- Gunakan tanda baca yang benar dan struktur kalimat yang rapi.
- Buat variasi tipe pertanyaan: definisi, aplikasi, analisis, situasional, dan evaluasi.
- Gunakan bahasa Indonesia yang natural, formal namun mudah dipahami.
- Hindari pola pertanyaan yang monoton dan membosankan.

CONTOH SOAL BAGUS:
1. Pertanyaan situasional: "Jika seorang siswa mengalami masalah X, langkah paling tepat yang harus dilakukan adalah..."
2. Pertanyaan aplikasi: "Konsep Y dapat diterapkan dalam situasi berikut, KECUALI..."
3. Pertanyaan analisis: "Dari pernyataan-pernyataan berikut, manakah yang menunjukkan pemahaman yang SALAH tentang Z?"
4. Pertanyaan evaluasi: "Manakah argumen yang paling kuat untuk mendukung pernyataan tentang W?"

KETENTUAN TEKNIS:
1. Buat EXACTLY ${totalQuestions} soal.
2. Setiap soal punya ${numOptions} pilihan jawaban.
3. Pilihan jawaban harus seragam panjang dan gaya penulisannya.
4. JANGAN tulis A, B, C, D atau bullet point di teks pilihan. Tulis TEKS JAWABAN SAJA.
5. Hanya 1 jawaban benar yang jelas.
6. Pengecoh harus masuk akal dan relevan (bukan "tidak ada di materi").
7. Tingkat kesulitan: ${difficulty}
8. Penjelasan 1-2 kalimat yang jelas.
9. Jawaban boleh di-rephrase secara kreatif selama makna tetap sama dengan materi.
10. PENTING: Setiap pilihan jawaban harus berupa SATU kalimat utuh yang jelas, bukan daftar atau poin-poin.
11. JANGAN gunakan penomoran seperti (1), (2), 2), 3. dalam pilihan jawaban.
12. Hindari format daftar atau instruksi bertahap dalam pilihan jawaban.
13. Gunakan tanda baca yang benar: koma, titik, tanda tanya, dll.
14. Pastikan struktur kalimat yang baik dan mudah dibaca.
15. KRITIS: JANGAN biarkan huruf tunggal (seperti "g", "f", dll) muncul di akhir pilihan jawaban. Ini adalah artifacts dari PDF.
16. Pastikan setiap pilihan jawaban berakhir dengan tanda baca yang benar (titik, koma, dll), bukan huruf tunggal.
17. DILARANG KERAS menggunakan tanda kutip ganda (") di dalam teks soal, opsi, atau penjelasan. Gunakan kutip tunggal (') jika perlu, agar format JSON tidak rusak!
18. PASTIKAN output HANYA JSON object valid, tanpa teks pendahuluan, tanpa blok markdown. MURNI JSON!

OUTPUT FORMAT (Wajib JSON object valid, TANPA format markdown tambahan):
{
  "questions": [
    {
      "question": "Pertanyaan yang menarik dan variatif?",
      "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
      "correctIndex": 0,
      "explanation": "Penjelasan singkat dan jelas.",
      "difficulty": "mudah"
    }
  ]
}

RANGKUMAN POIN PENTING:
---
${trimmedMaterial}
---

Buat ${totalQuestions} soal sekarang:`;
}

/**
 * Summarize material into key points for question generation
 * This ensures questions are based on understanding, not raw text
 */
export async function summarizeMaterial(
  materialText: string,
  apiKey: string,
  userModel?: string | null
): Promise<string> {
  // Jika materi cukup pendek (kurang dari 8000 karakter / ~1500 kata), langsung gunakan materi aslinya untuk menghemat waktu (skip summarization)
  if (materialText.length < 8000) {
    console.log("[Gemini] Material is short enough, skipping summarization.");
    return materialText;
  }

  const MAX_MATERIAL_CHARS = 15000;
  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) +
        "\n\n[...materi dipotong untuk efisiensi...]"
      : materialText;

  console.log("[Gemini] Starting summarization process...");
  console.log("[Gemini] Material length:", materialText.length);

  const summaryPrompt = `Kamu adalah ahli dalam merangkum materi pendidikan. Tugas: Rangkum materi di bawah menjadi poin-poin penting yang jelas dan terstruktur.

PRINSIP:
- Fokus pada konsep utama, definisi penting, dan poin kunci
- Buat rangkuman yang mudah dipahami
- Gunakan bahasa Indonesia yang jelas dan formal
- Hilangkan detail yang tidak penting atau repetitif
- Strukturkan dengan poin-poin yang logis

OUTPUT FORMAT:
- Gunakan format poin dengan tanda dash (-)
- Setiap poin berisi satu konsep atau ide penting
- Maksimal 15-20 poin penting
- Hindari menyalin kalimat mentah dari materi

MATERI:
---
${trimmedMaterial}
---

Buat rangkuman sekarang:`;

  try {
    console.log("[Gemini] Calling Gemini API for summarization...");
    const summaryText = await callGeminiAPI(summaryPrompt, apiKey, userModel);
    console.log("[Gemini] Summarization successful, length:", summaryText.length);
    // Clean the summary
    const cleanedSummary = cleanGeneratedText(summaryText);
    console.log("[Gemini] Summary cleaned, returning...");
    return cleanedSummary;
  } catch (error) {
    console.error("[Gemini] Gagal merangkum materi:", error);
    // Fallback to original material if summarization fails
    console.log("[Gemini] Falling back to original material");
    return trimmedMaterial;
  }
}

/**
 * Clean up generated text for better punctuation and grammar
 */
function cleanGeneratedText(text: string, isOption: boolean = false): string {
  let cleaned = text.trim();
  
  // Remove single letters at the end (common PDF artifacts)
  cleaned = cleaned.replace(/\s+[a-zA-Z]$/g, "");
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s*$/g, "");
  
  // Remove single letters followed by punctuation
  cleaned = cleaned.replace(/\s+[a-zA-Z][.,;:!?]$/g, "");
  
  // Fix spacing around punctuation
  cleaned = cleaned.replace(/\s+([.,;:!?)])/g, "$1");
  cleaned = cleaned.replace(/([(])\s+/g, "$1");
  
  // Fix multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  
  // Fix capitalization at start of sentences
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  
  if (!isOption) {
    // Ensure proper ending punctuation
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += ".";
    }
  } else {
    // Untuk opsi, hapus titik di akhir supaya seragam
    cleaned = cleaned.replace(/[.]$/, "");
  }
  
  // Remove any trailing punctuation duplicates
  cleaned = cleaned.replace(/([.!?])\1+/g, "$1");
  
  // Remove single letter words that are likely artifacts (except common abbreviations)
  cleaned = cleaned.replace(/\s+[a-z]\s+(?=[.,;:!?]|$)/gi, " ");
  
  return cleaned;
}

/**
 * Kirim request ke Gemini API dan kembalikan teks respons.
 */
async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  userModel?: string | null,
  maxTokens: number = 2048,
  requireJson: boolean = false
): Promise<string> {
  console.log("[Gemini] Calling API...");
  
  const modelToUse = userModel || await getAvailableGeminiModel(apiKey);
  // modelToUse expects format "models/gemini-1.5-flash"
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${apiKey}`;

  const generationConfig: any = {
    temperature: 0.7,
    maxOutputTokens: maxTokens,
  };
  
  if (requireJson) {
    generationConfig.responseMimeType = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

  let response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Gemini API request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as GeminiResponse;
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${errMsg}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini tidak mengembalikan konten.");
  }
  return text;
}

/**
 * Parse teks JSON dari Gemini menjadi array soal.
 * Toleran terhadap respons yang dibungkus markdown code block (```json ... ```).
 */
function parseGeminiResponse(text: string): RawQuestion[] {
  let clean = text.trim();
  
  // Hapus tag markdown ```json dan ``` secara manual
  clean = clean.replace(/^```json\s*/i, "");
  clean = clean.replace(/^```\s*/, "");
  clean = clean.replace(/```\s*$/, "");
  
  // Jika response berupa array, ambil array-nya
  if (clean.trim().startsWith('[')) {
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) clean = arrayMatch[0];
  } 
  // Jika response berupa object, ambil object-nya
  else if (clean.trim().startsWith('{')) {
    const objectMatch = clean.match(/\{[\s\S]*\}/);
    if (objectMatch) clean = objectMatch[0];
  }

  // Coba perbaiki bracket jika terpotong
  if (clean.trim().startsWith('{')) {
    if (!clean.endsWith('}')) {
      if (!clean.endsWith(']')) {
        clean += '"}';
      }
      clean += ']}';
    }
  } else if (clean.trim().startsWith('[')) {
    if (!clean.endsWith(']')) {
      if (!clean.endsWith('}')) {
        clean += '"}';
      }
      clean += ']';
    }
  }

  const parsed = JSON.parse(clean) as any;
  const questionsArray = parsed.questions || parsed;

  if (!Array.isArray(questionsArray)) {
    throw new Error("Format respons Gemini tidak valid (tidak ada array 'questions').");
  }

  return questionsArray.map((item: unknown, idx: number) => {
    const q = item as Record<string, unknown>;
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      typeof q.correctIndex !== "number"
    ) {
      throw new Error(`Soal #${idx + 1} memiliki format yang tidak valid.`);
    }
    return {
      question: cleanGeneratedText(q.question as string),
      options: (q.options as string[]).map((o) => cleanGeneratedText(String(o), true)),
      correctIndex: q.correctIndex as number,
      explanation:
        typeof q.explanation === "string"
          ? cleanGeneratedText(q.explanation as string)
          : "Berdasarkan materi yang diberikan.",
      difficulty:
        typeof q.difficulty === "string"
          ? (q.difficulty as string).trim()
          : "sedang",
    };
  });
}

/**
 * Generate quiz menggunakan Gemini AI.
 *
 * @param materialText - Teks materi yang sudah diekstrak dari file
 * @param config - Konfigurasi quiz (jumlah soal, kesulitan, dll)
 * @param apiKey - Gemini API key
 * @param userModel - (Opsional) Model Gemini yang digunakan
 * @returns Array soal yang sudah digenerate
 */
export async function generateQuizWithAI(
  materialText: string,
  config: QuizConfig,
  apiKey: string,
  userModel?: string | null
): Promise<GeneratedQuestion[]> {
  const targetCount = config.totalQuestions || 10;

  // STEP 1: Summarize material first
  const summary = await summarizeMaterial(materialText, apiKey, userModel);

  // STEP 2: Generate questions from the summary (not raw material)
  const prompt = buildPrompt(summary, config, targetCount);
  const rawText = await callGeminiAPI(prompt, apiKey, userModel, 4096, true);
  
  let rawQuestions;
  try {
    rawQuestions = parseGeminiResponse(rawText);
  } catch (error) {
    console.warn("[Gemini] Parse failed, trying JSON fix...", error);
    const fixPrompt = `Perbaiki JSON berikut agar menjadi valid JSON object dengan key "questions" yang berisi array soal. Ganti tanda kutip ganda di dalam string dengan kutip tunggal. Hanya output JSON murni tanpa markdown:\n\n${rawText}`;
    const fixedText = await callGeminiAPI(fixPrompt, apiKey, userModel, 4096, true);
    rawQuestions = parseGeminiResponse(fixedText);
  }

  if (rawQuestions.length === 0) {
    throw new Error("Gemini tidak menghasilkan soal.");
  }

  // Konversi ke format GeneratedQuestion (biarkan semua lolos, akan difilter & di-slice di quizGenerator)
  return rawQuestions.map((q: RawQuestion) => {
    // Bersihkan pilihan jawaban dari bullet point atau huruf (misal: "A. ", " • ", "- ")
    const cleanOptions = q.options.map(opt => {
      let text = opt.trim();
      text = text.replace(/^[A-Ea-e][.)]\s*/, ""); // hapus A., B), c.
      text = text.replace(/^[-•*·○]\s*/, ""); // hapus bullet point atau dash
      return text.trim();
    });

    // Pastikan correctIndex dalam batas
    const safeIdx = Math.min(
      Math.max(0, q.correctIndex),
      cleanOptions.length - 1,
    );

    return {
      question: q.question.trim(),
      options: cleanOptions,
      correctIndex: safeIdx,
      explanation: q.explanation.trim(),
      difficulty: q.difficulty || "sedang",
      sourceReference: "AI Generated",
      fingerprint: fingerprintQuestion(q.question),
    };
  });
}

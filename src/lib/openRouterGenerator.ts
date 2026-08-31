import type { QuizConfig } from "../types";
import type { GeneratedQuestion } from "./quizGenerator";
import { fingerprintQuestion } from "./quizGenerator";

interface RawQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const MAX_MATERIAL_CHARS = 12000;

let cachedOpenRouterModels: string[] | null = null;

export async function getOpenRouterModelsList(apiKey?: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(OPENROUTER_MODELS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    const models = data.data as Array<{ id: string }>;
    // Kembalikan hanya model gratis
    return models.filter(m => m.id.endsWith(":free")).map(m => m.id).sort();
  } catch (err) {
    console.error("Failed to fetch OpenRouter models list:", err);
    return [];
  }
}

async function getAvailableOpenRouterModels(apiKey: string): Promise<string[]> {
  if (cachedOpenRouterModels) return cachedOpenRouterModels;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(OPENROUTER_MODELS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error("Failed to fetch models");
    
    const data = await res.json();
    const models = data.data as Array<{ id: string; pricing?: { prompt: string; completion: string } }>;
    
    // Cari model gratis (:free)
    const freeModels = models.filter(m => m.id.endsWith(":free")).map(m => m.id);
    
    if (freeModels.length > 0) {
      // Prioritaskan model terkenal
      const preferredKeywords = ["llama", "gemini", "gemma", "mistral", "liquid", "minimax"];
      const bestModels = freeModels.filter(id => preferredKeywords.some(k => id.toLowerCase().includes(k)));
      
      // Ambil 3 model terbaik untuk fallback, atau model acak jika tidak ada
      const fallbackList = bestModels.length > 0 ? bestModels.slice(0, 3) : freeModels.slice(0, 3);
      console.log("[OpenRouter] Using fallback models:", fallbackList);
      
      cachedOpenRouterModels = fallbackList;
      return fallbackList;
    }
    
    return ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free"];
  } catch (error) {
    console.warn("[OpenRouter] Auto-discovery failed, using fallback.");
    return ["google/gemma-2-9b-it:free", "meta-llama/llama-3-8b-instruct:free"];
  }
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function buildPrompt(
  materialText: string,
  config: QuizConfig,
  totalQuestions: number
): string {
  const difficulty = config.difficulty || "sedang";

  return `Anda adalah AI ahli pembuat soal ujian (Quiz Generator) berbahasa Indonesia.
Buatlah ${totalQuestions} soal pilihan ganda berdasarkan ringkasan materi di bawah ini.

ATURAN KETAT:
1. Setiap soal harus relevan dengan materi.
2. Setiap soal memiliki persis 4 pilihan (A, B, C, D).
3. Hanya 1 jawaban benar yang jelas.
4. Tingkat kesulitan: ${difficulty}
5. Penjelasan 1-2 kalimat yang jelas.
6. JANGAN gunakan penomoran seperti (1), (2), 2), 3. dalam pilihan jawaban.
7. Pastikan setiap pilihan jawaban berakhir dengan tanda baca yang benar (titik, koma, dll), bukan huruf tunggal.
8. JANGAN GUNAKAN tag <think> atau rantai pemikiran. Langsung keluarkan JSON murni!
9. SANGAT PENTING: Jangan gunakan tanda kutip ganda (") di dalam teks jawaban atau penjelasan. Gunakan tanda kutip tunggal (') jika perlu, agar format JSON tidak rusak.

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
${materialText}
---

Buat ${totalQuestions} soal sekarang dan HANYA kembalikan JSON object valid dengan key "questions" (tanpa penjelasan tambahan):`;
}

export async function summarizeMaterialOpenRouter(
  materialText: string,
  apiKey: string,
  userModel?: string | null
): Promise<string> {
  // Optimasi: untuk materi pendek, langsung pakai tanpa AI summarization
  // (hemat 1 round-trip + lebih cepat)
  if (materialText.length < 3000) {
    console.log("[OpenRouter] Material is short, skipping summarization.");
    return materialText;
  }

  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) +
        "\n\n[...materi dipotong untuk efisiensi...]"
      : materialText;

  console.log("[OpenRouter] Starting summarization process...");
  const summaryPrompt = `Rangkum materi di bawah menjadi 15-20 poin-poin penting menggunakan bahasa Indonesia yang jelas. Jangan sertakan teks lain selain rangkuman.

MATERI:
---
${trimmedMaterial}
---

Rangkuman:`;

  try {
    const rawText = await callOpenRouterAPI(summaryPrompt, apiKey, 800, userModel);
    return cleanGeneratedText(rawText);
  } catch (error) {
    console.error("[OpenRouter] Gagal merangkum materi:", error);
    return trimmedMaterial;
  }
}

function cleanGeneratedText(text: string, isOption: boolean = false): string {
  if (!text) return "";
  let cleaned = text.trim();
  
  // Hapus numbering seperti A., B), dll di awal teks
  cleaned = cleaned.replace(/^[A-Ea-e][.)]\s*/, "");
  // Hapus bullet points
  cleaned = cleaned.replace(/^[-•*·○]\s*/, "");
  
  if (!isOption) {
    if (!/[.!?]$/.test(cleaned) && cleaned.length > 5) {
      cleaned += ".";
    }
  } else {
    // Untuk opsi, hapus titik di akhir supaya seragam
    cleaned = cleaned.replace(/[.]$/, "");
  }
  
  return cleaned;
}

async function callOpenRouterAPI(
  prompt: string,
  apiKey: string,
  maxTokens: number = 1500,
  userModel?: string | null,
  requireJson: boolean = false
): Promise<string> {
  console.log("[OpenRouter] Calling OpenRouter API...");
  
  // Jika user memilih model spesifik, gunakan model tersebut, jika tidak gunakan auto-fallback array
  const modelsToUse = userModel ? [userModel] : await getAvailableOpenRouterModels(apiKey);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const requestBody: any = {
    models: modelsToUse,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  if (requireJson) {
    requestBody.response_format = { type: "json_object" };
  }

  let response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Quiz Simulator AI",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("OpenRouter API request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as OpenRouterResponse;
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`OpenRouter API error: ${errMsg}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenRouter tidak mengembalikan konten.");
  }
  return text;
}

function parseOpenRouterResponse(text: string): RawQuestion[] {
  let clean = text.trim();
  
  // Hapus blok <think>...</think> ATAU <think>... sampai akhir (jika terpotong)
  clean = clean.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();
  
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

  // Auto fix truncated object/array
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
    throw new Error("Format respons OpenRouter tidak valid (bukan array 'questions').");
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
      explanation: typeof q.explanation === "string" ? cleanGeneratedText(q.explanation as string) : "Berdasarkan materi yang diberikan.",
      difficulty: typeof q.difficulty === "string" ? (q.difficulty as string).trim() : "sedang",
    };
  });
}

export async function generateQuizWithOpenRouter(
  materialText: string,
  config: QuizConfig,
  apiKey: string,
  userModel?: string | null
): Promise<GeneratedQuestion[]> {
  const targetCount = config.totalQuestions || 10;
  
  const summary = await summarizeMaterialOpenRouter(materialText, apiKey, userModel);
  const prompt = buildPrompt(summary, config, targetCount);
  // Optimasi: max_tokens adaptif — lebih kecil untuk materi pendek
  // Materi <3000 char biasanya butuh ~1200 tokens untuk 10 soal
  const adaptiveMaxTokens = materialText.length < 3000 ? 1200 : 2000;
  const rawText = await callOpenRouterAPI(prompt, apiKey, adaptiveMaxTokens, userModel, true);
  
  const rawQuestions = parseOpenRouterResponse(rawText);

  if (rawQuestions.length === 0) {
    throw new Error("OpenRouter tidak menghasilkan soal.");
  }

  return rawQuestions.map((q: RawQuestion) => {
    const cleanOptions = q.options.map((opt: string) => {
      let text = opt.trim();
      text = text.replace(/^[A-Ea-e][.)]\s*/, "");
      text = text.replace(/^[-•*·○]\s*/, "");
      return text.trim();
    });

    const safeIdx = Math.min(Math.max(0, q.correctIndex), cleanOptions.length - 1);

    return {
      question: q.question.trim(),
      options: cleanOptions,
      correctIndex: safeIdx,
      explanation: q.explanation.trim(),
      difficulty: q.difficulty || "sedang",
      sourceReference: "OpenRouter AI Generated",
      fingerprint: fingerprintQuestion(q.question.trim()),
    };
  });
}

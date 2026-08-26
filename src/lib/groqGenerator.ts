/**
 * groqGenerator.ts
 * -------------------
 * Menggunakan Groq API (OpenAI compatible) untuk menghasilkan soal quiz.
 */

import type { QuizConfig } from "../types";
import type { GeneratedQuestion } from "./quizGenerator";
import { fingerprintQuestion } from "./quizGenerator";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

let cachedGroqModel: string | null = null;

export async function getGroqModelsList(apiKey: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    const models = data.data as Array<{ id: string }>;
    
    // Filter the safe models just like getAvailableGroqModel does
    return models
      .filter(m => !m.id.toLowerCase().includes("whisper") && 
                   !m.id.toLowerCase().includes("guard") && 
                   !m.id.toLowerCase().includes("vision") &&
                   !m.id.toLowerCase().includes("embed") &&
                   !m.id.toLowerCase().includes("allam"))
      .map(m => m.id)
      .sort();
  } catch (err) {
    console.error("Failed to fetch Groq models list:", err);
    return [];
  }
}

export async function getAvailableGroqModel(apiKey: string): Promise<string> {
  if (cachedGroqModel) return cachedGroqModel;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const models = data.data as { id: string }[];
      
      const avoidKeywords = ["guard", "whisper", "vision", "tool-use", "embed", "allam"];
      
      // Get all models that are NOT guard/whisper/vision etc
      const safeModels = models.filter(m => !avoidKeywords.some(avoid => m.id.toLowerCase().includes(avoid)));
      
      console.log("[Groq] All available models on this API key:", models.map(m => m.id));
      
      const preferredKeywords = ["gpt-oss", "llama", "mixtral", "gemma", "versatile", "instant", "qwen", "deepseek"];
      
      const suitableModels = safeModels.filter(m => 
        preferredKeywords.some(pref => m.id.toLowerCase().includes(pref))
      );

      // Prioritize suitable chat models
      if (suitableModels.length > 0) {
        // Prioritize gpt-oss, then latest llama
        const gptModel = suitableModels.find(m => m.id.includes("gpt-oss-120b") || m.id.includes("gpt-oss"));
        if (gptModel) {
          cachedGroqModel = gptModel.id;
          return cachedGroqModel;
        }
        
        const latestLlama = suitableModels.find(m => m.id.includes("3.3") || m.id.includes("3.1"));
        if (latestLlama) {
          cachedGroqModel = latestLlama.id;
          return cachedGroqModel;
        }
        const largeModel = suitableModels.find(m => m.id.includes("70b") || m.id.includes("mixtral") || m.id.includes("8b"));
        cachedGroqModel = largeModel ? largeModel.id : suitableModels[0].id;
        return cachedGroqModel;
      }
      
      // If no preferred ones match, just pick the first SAFE model
      if (safeModels.length > 0) {
        cachedGroqModel = safeModels[0].id;
        return cachedGroqModel;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch Groq models, falling back to default.", e);
  }
  return "llama3-8b-8192";
}

const MAX_MATERIAL_CHARS = 8000;

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message: string };
}

interface RawQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
}

function buildPrompt(
  materialText: string,
  config: QuizConfig,
  totalQuestions: number,
): string {
  const difficultyDesc: Record<string, string> = {
    mudah: "mudah — fokus pada fakta utama dan definisi dasar",
    sedang: "sedang — memerlukan pemahaman konsep dan kemampuan menganalisis",
    sulit: "sulit — memerlukan analisis mendalam, sintesis, atau evaluasi konsep",
    campuran: "campuran — variasikan antara mudah, sedang, dan sulit secara merata",
  };

  const difficulty = difficultyDesc[config.difficulty] || "sedang";
  const numOptions = config.numberOfOptions;

  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) +
        "\n\n[...materi dipotong untuk efisiensi...]"
      : materialText;

  return `Kamu adalah guru profesional yang kreatif dalam membuat soal ujian. Target: buat soal yang menantang, variatif, dan tidak membosankan.

Tugas: Buat TEPAT ${totalQuestions} soal pilihan ganda berdasarkan RANGKUMAN POIN PENTING di bawah.

PRINSIP UTAMA:
- Materi di bawah adalah RANGKUMAN POIN PENTING, bukan teks mentah.
- Buat soal dari pemahaman poin-poin penting ini.
- Fokus pada MAKNA dan KONSEP, bukan kata-kata persis.
- Jawaban boleh di-rephrase secara kreatif.
- Gunakan bahasa Indonesia yang baik, jelas, dan terstruktur.

KETENTUAN TEKNIS:
1. Buat EXACTLY ${totalQuestions} soal.
2. Setiap soal punya ${numOptions} pilihan jawaban.
3. JANGAN tulis A, B, C, D atau bullet point di teks pilihan. Tulis TEKS JAWABAN SAJA.
4. Hanya 1 jawaban benar yang jelas.
5. Tingkat kesulitan: ${difficulty}
6. Penjelasan 1-2 kalimat yang jelas.
7. JANGAN gunakan penomoran seperti (1), (2), 2), 3. dalam pilihan jawaban.
8. Pastikan setiap pilihan jawaban berakhir dengan tanda baca yang benar (titik, koma, dll), bukan huruf tunggal.
9. JANGAN GUNAKAN tag <think> atau rantai pemikiran. Langsung keluarkan JSON murni!
10. SANGAT PENTING: Jangan gunakan tanda kutip ganda (") di dalam teks jawaban atau penjelasan. Gunakan tanda kutip tunggal (') jika perlu, agar format JSON tidak rusak.

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

Buat ${totalQuestions} soal sekarang dan HANYA kembalikan JSON object valid dengan key "questions" (tanpa penjelasan tambahan):`;
}

export async function summarizeMaterialGroq(
  materialText: string,
  apiKey: string,
  userModel?: string | null
): Promise<string> {
  // Jika materi pendek, skip summarization untuk kecepatan
  if (materialText.length < 5000) {
    console.log("[Groq] Material is short enough, skipping summarization.");
    return materialText;
  }

  const MAX_MATERIAL_CHARS = 10000;
  const trimmedMaterial =
    materialText.length > MAX_MATERIAL_CHARS
      ? materialText.slice(0, MAX_MATERIAL_CHARS) +
        "\n\n[...materi dipotong untuk efisiensi...]"
      : materialText;

  console.log("[Groq] Starting summarization process...");
  const summaryPrompt = `Rangkum materi di bawah menjadi 15-20 poin-poin penting menggunakan bahasa Indonesia yang jelas. Jangan sertakan teks lain selain rangkuman.

MATERI:
---
${trimmedMaterial}
---

Rangkuman:`;

  try {
    const rawText = await callGroqAPI(summaryPrompt, apiKey, 800, userModel);
    return cleanGeneratedText(rawText);
  } catch (error) {
    console.error("[Groq] Gagal merangkum materi:", error);
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

async function callGroqAPI(
  prompt: string,
  apiKey: string,
  maxTokens: number = 1500,
  userModel?: string | null,
  requireJson: boolean = false
): Promise<string> {
  console.log("[Groq] Calling Groq API...");
  
  const modelToUse = userModel || await getAvailableGroqModel(apiKey);
  console.log("[Groq] Using model:", modelToUse);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const requestBody: any = {
    model: modelToUse,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  if (requireJson) {
    requestBody.response_format = { type: "json_object" };
  }

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Groq API request timed out after 60 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as GroqResponse;
    const errMsg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Groq API error: ${errMsg}`);
  }

  const data = (await response.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Groq tidak mengembalikan konten.");
  }
  return text;
}

function parseGroqResponse(text: string): RawQuestion[] {
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
  const questionsArray = parsed.questions || parsed; // Fallback jika Groq tetap mengembalikan array

  if (!Array.isArray(questionsArray)) {
    throw new Error("Format respons Groq tidak valid (tidak ada array 'questions').");
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

export async function generateQuizWithGroq(
  materialText: string,
  config: QuizConfig,
  apiKey: string,
  userModel?: string | null
): Promise<GeneratedQuestion[]> {
  const targetCount = config.totalQuestions || 10;
  
  const summary = await summarizeMaterialGroq(materialText, apiKey, userModel);
  const prompt = buildPrompt(summary, config, targetCount);
  const rawText = await callGroqAPI(prompt, apiKey, 3000, userModel, true);
  
  const rawQuestions = parseGroqResponse(rawText);

  if (rawQuestions.length === 0) {
    throw new Error("Groq tidak menghasilkan soal.");
  }

  return rawQuestions.map((q: RawQuestion) => {
    const cleanOptions = q.options.map(opt => {
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
      sourceReference: "AI Generated (Groq)",
      fingerprint: fingerprintQuestion(q.question),
    };
  });
}

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Loader2, FileText, AlertCircle, Sparkles } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getMaterialById, getQuestionsByMaterial, createQuiz, saveQuestions } from "../lib/db";
import { generateQuiz } from "../lib/quizGenerator";
import { getGeminiKey, hasGeminiKey } from "../lib/geminiKeyStore";
import { hasGroqKey, getPrimaryApi, hasOpenRouterKey, hasCohereKey } from "../lib/settingsStore";
import type { Material, Question, QuizConfig as QConfig, Difficulty, StyleMode, QuizMode } from "../types";
import OptionSelector from "../components/OptionSelector";
import Toggle from "../components/Toggle";
import PageHeader from "../components/PageHeader";
import { Banner } from "../components/Toast";

const QUESTION_OPTIONS = [
  { value: 5, label: "5 soal" },
  { value: 10, label: "10 soal" },
  { value: 15, label: "15 soal" },
  { value: 20, label: "20 soal" },
  { value: 25, label: "25 soal" },
  { value: -1, label: "Custom" },
];

const OPTION_COUNTS = [
  { value: 2, label: "2 (A-B)" },
  { value: 3, label: "3 (A-C)" },
  { value: 4, label: "4 (A-D)" },
  { value: 5, label: "5 (A-E)" },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
  { value: "campuran", label: "Campuran" },
];

export default function QuizConfig() {
  const { materialId } = useParams<{ materialId: string }>();
  const { user } = useUser();
  const navigate = useNavigate();

  const [material, setMaterial] = useState<Material | null>(null);
  const [existingQuestions, setExistingQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<QConfig>({
    totalQuestions: 10,
    numberOfOptions: 4,
    difficulty: "campuran",
    styleMode: "default",
    styleExamples: "",
    quizMode: "baru",
    shuffleQuestions: true,
    shuffleOptions: true,
  });

  const [customQuestions, setCustomQuestions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [usedAI, setUsedAI] = useState(false);

  const hasApiKey = user ? hasGeminiKey(user.id, user.gemini_api_key) : false;
  const currentHasGroqKey = user ? hasGroqKey(user.id) : false;
  const currentHasOpenRouterKey = user ? hasOpenRouterKey(user.id) : false;
  const currentHasCohereKey = user ? hasCohereKey(user.id) : false;
  const primaryApi = user ? getPrimaryApi(user.id) : "cohere";
  
  // Hanya true jika API yang dipilih benar-benar tersedia
  const isAiActive = 
    (primaryApi === "groq" && currentHasGroqKey) ||
    (primaryApi === "openrouter" && currentHasOpenRouterKey) ||
    (primaryApi === "cohere" && currentHasCohereKey);

  useEffect(() => {
    if (!materialId) return;
    Promise.all([
      getMaterialById(materialId),
      getQuestionsByMaterial(materialId),
    ])
      .then(([m, qs]) => {
        setMaterial(m);
        setExistingQuestions(qs);
        // If there are existing questions, default to "baru" mode (different questions)
        if (qs.length > 0) {
          setConfig((c) => ({ ...c, quizMode: "baru" }));
        }
      })
      .finally(() => setLoading(false));
  }, [materialId]);

  const updateConfig = (patch: Partial<QConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const totalQuestions = config.totalQuestions === -1 ? parseInt(customQuestions) || 10 : config.totalQuestions;

  const handleGenerate = async () => {
    if (!material || !user || !materialId) return;
    setGenerating(true);
    setGenError(null);

    try {
      const finalConfig: QConfig = {
        ...config,
        totalQuestions: totalQuestions,
      };

      // Ambil Gemini API key milik user (dari cache atau DB)
      const geminiKey = user ? (getGeminiKey(user.id, user.gemini_api_key) ?? undefined) : undefined;

      const result = await generateQuiz(
        material.extracted_text,
        finalConfig,
        config.quizMode === "baru" ? existingQuestions : [],
        geminiKey,
        user.id // Pass user ID to fetch primaryApi setting inside generator
      );

      setUsedAI(result.generatedByAI);
      if (result.questions.length === 0) {
        setGenError(
          "Materi belum cukup untuk membuat soal. Silakan kurangi jumlah soal atau tambahkan materi.",
        );
        setGenerating(false);
        return;
      }

      if (result.insufficient && config.quizMode === "baru") {
        // We generated some but not enough — still proceed but inform
        // For now, proceed with what we have
      }

      const quiz = await createQuiz(
        user.id,
        materialId,
        material.filename.replace(/\.[^.]+$/, ""),
        { ...finalConfig, totalQuestions: result.questions.length },
      );

      await saveQuestions(quiz.id, materialId, result.questions);

      setGenerating(false);
      navigate(`/quiz/play/${quiz.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat quiz. Silakan coba lagi.";
      setGenError(msg);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <Banner type="error">Materi tidak ditemukan.</Banner>
        <button onClick={() => navigate("/create")} className="btn-primary mt-4">
          Upload Materi Baru
        </button>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
        <PageHeader title="Konfigurasi Quiz" subtitle="Ringkasan" />

        {/* AI status in summary */}
        {usedAI ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 border border-primary-200">
            <Sparkles size={16} className="text-primary-500" />
            Soal berhasil dibuat menggunakan AI — kualitas lebih baik!
          </div>
        ) : !isAiActive ? (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            <span className="font-semibold">⚠️ Dibuat tanpa AI.</span>{" "}
            <button
              onClick={() => navigate("/profile")}
              className="underline font-semibold hover:text-amber-900"
            >
              Pilih / Set API Key (Gemini/Groq/OpenRouter/Cohere) di Profil
            </button>{" "}
            untuk soal yang lebih akurat.
          </div>
        ) : null}

        {genError && (
          <div className="mb-5">
            <Banner type="error">{genError}</Banner>
          </div>
        )}

        <div className="card mb-5 p-5">
          <h2 className="mb-4 text-base font-bold text-neutral-800">Konfigurasi Quiz</h2>
          <div className="space-y-3">
            <SummaryRow label="Materi" value={material.filename} />
            <SummaryRow label="Jumlah soal" value={`${totalQuestions} soal`} />
            <SummaryRow label="Pilihan jawaban" value={`${config.numberOfOptions} (${"ABCDE".slice(0, config.numberOfOptions)})`} />
            <SummaryRow label="Tingkat kesulitan" value={DIFFICULTIES.find((d) => d.value === config.difficulty)?.label || ""} />
            <SummaryRow label="Gaya soal" value={config.styleMode === "custom" ? "Contoh soal saya" : "Default"} />
            <SummaryRow label="Mode" value={config.quizMode === "sama" ? "Soal Sama" : "Soal Berbeda"} />
            <SummaryRow label="Acak soal" value={config.shuffleQuestions ? "ON" : "OFF"} />
            <SummaryRow label="Acak jawaban" value={config.shuffleOptions ? "ON" : "OFF"} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowSummary(false)} className="btn-secondary flex-1" disabled={generating}>
            Kembali
          </button>
          <button onClick={handleGenerate} className="btn-primary flex-1" disabled={generating}>
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Membuat...
              </>
            ) : (
              <>
                Generate Quiz <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader title="Konfigurasi Quiz" subtitle={material.filename} backTo="/create" />

      {/* AI status banner */}
      {isAiActive ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 border border-primary-200">
          <Sparkles size={16} className="text-primary-500" />
          API aktif — soal akan dibuat dengan AI ({primaryApi === "cohere" ? "Cohere" : primaryApi === "openrouter" ? "OpenRouter" : primaryApi === "groq" ? "Groq" : "Gemini"})
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <span className="font-semibold">💡 Tip:</span>{" "}
          <button
            onClick={() => navigate("/profile")}
            className="underline font-semibold hover:text-amber-900"
          >
            Pilih/Tambahkan API Key di Profil
          </button>{" "}
          untuk menghasilkan soal yang jauh lebih akurat dan natural.
        </div>
      )}

      {/* Material info */}
      <div className="card mb-5 flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <FileText size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-700">{material.filename}</p>
          <p className="text-xs text-neutral-400">
            {material.file_type.toUpperCase()} · {material.quiz_count} quiz sebelumnya
          </p>
        </div>
      </div>

      {/* A. Jumlah Soal */}
      <Section title="Jumlah Soal" badge="A">
        <OptionSelector
          options={QUESTION_OPTIONS}
          value={config.totalQuestions}
          onChange={(v) => updateConfig({ totalQuestions: v as number })}
        />
        {config.totalQuestions === -1 && (
          <input
            type="number"
            min={1}
            max={50}
            className="input mt-3"
            placeholder="Masukkan jumlah soal"
            value={customQuestions}
            onChange={(e) => setCustomQuestions(e.target.value)}
          />
        )}
        {existingQuestions.length > 0 && config.quizMode === "baru" && existingQuestions.length >= totalQuestions && (
          <p className="helper text-warning-600">
            <AlertCircle size={12} className="inline mr-1" />
            Materi sudah digunakan untuk {existingQuestions.length} soal sebelumnya. Mode "Soal Berbeda" akan menghindari duplikat.
          </p>
        )}
      </Section>

      {/* B. Jumlah Pilihan Jawaban */}
      <Section title="Jumlah Pilihan Jawaban" badge="B">
        <OptionSelector
          options={OPTION_COUNTS}
          value={config.numberOfOptions}
          onChange={(v) => updateConfig({ numberOfOptions: v as number })}
        />
      </Section>

      {/* C. Tingkat Kesulitan */}
      <Section title="Tingkat Kesulitan" badge="C">
        <OptionSelector
          options={DIFFICULTIES}
          value={config.difficulty}
          onChange={(v) => updateConfig({ difficulty: v as Difficulty })}
        />
      </Section>

      {/* D. Gaya Soal */}
      <Section title="Gaya Soal (Opsional)" badge="D">
        <div className="flex gap-2">
          <button
            onClick={() => updateConfig({ styleMode: "default" as StyleMode })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              config.styleMode === "default"
                ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            Gunakan gaya default
          </button>
          <button
            onClick={() => updateConfig({ styleMode: "custom" as StyleMode })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              config.styleMode === "custom"
                ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            Gunakan contoh soal saya
          </button>
        </div>
        {config.styleMode === "custom" && (
          <>
            <textarea
              className="input mt-3 min-h-[100px] resize-y"
              placeholder="Masukkan contoh soal yang ingin dijadikan acuan gaya..."
              value={config.styleExamples}
              onChange={(e) => updateConfig({ styleExamples: e.target.value })}
              rows={4}
            />
            <p className="helper">
              Opsional. AI akan mengikuti karakter dan pola contoh soal ini, tetapi isi soal tetap dibuat berdasarkan materi yang Anda upload.
            </p>
          </>
        )}
      </Section>

      {/* E. Mode Quiz */}
      <Section title="Mode Quiz" badge="E">
        <div className="flex gap-2">
          <button
            onClick={() => updateConfig({ quizMode: "sama" as QuizMode })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              config.quizMode === "sama"
                ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            Soal Sama
          </button>
          <button
            onClick={() => updateConfig({ quizMode: "baru" as QuizMode })}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              config.quizMode === "baru"
                ? "border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            Soal Berbeda
          </button>
        </div>
        <p className="helper">
          {config.quizMode === "sama"
            ? "Menggunakan pertanyaan yang sama persis dari quiz sebelumnya."
            : "Generate pertanyaan baru berdasarkan materi yang sama, menghindari soal duplikat."}
        </p>
        {config.quizMode === "sama" && existingQuestions.length === 0 && (
          <p className="helper text-warning-600">Belum ada soal tersimpan untuk materi ini. Mode "Soal Sama" akan membuat soal baru.</p>
        )}
      </Section>

      {/* F & G. Toggles */}
      <Section title="Pengaturan Tambahan" badge="F/G">
        <div className="space-y-4">
          <Toggle
            label="Acak Urutan Soal"
            description="Soal akan ditampilkan dalam urutan acak"
            checked={config.shuffleQuestions}
            onChange={(v) => updateConfig({ shuffleQuestions: v })}
          />
          <div className="border-t border-neutral-100" />
          <Toggle
            label="Acak Pilihan Jawaban"
            description="Posisi pilihan jawaban diacak setiap soal"
            checked={config.shuffleOptions}
            onChange={(v) => updateConfig({ shuffleOptions: v })}
          />
        </div>
      </Section>

      {genError && (
        <div className="mb-5">
          <Banner type="error">{genError}</Banner>
        </div>
      )}

      {/* Action */}
      <button onClick={() => setShowSummary(true)} className="btn-primary w-full">
        Lanjut ke Ringkasan <ArrowRight size={18} />
      </button>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        {badge && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-100 text-xs font-bold text-primary-700">
            {badge}
          </span>
        )}
        <h2 className="text-sm font-bold text-neutral-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2.5 last:border-0 last:pb-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-semibold text-neutral-800 text-right">{value}</span>
    </div>
  );
}

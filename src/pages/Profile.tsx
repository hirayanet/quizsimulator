import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Info, Shield, Key, Eye, EyeOff, ExternalLink, Trash2, Check, RefreshCw, Star, Smartphone, Download } from "lucide-react";
import { useUser } from "../context/UserContext";
import PageHeader from "../components/PageHeader";
import { saveGeminiKeyToDB, clearGeminiKeyFromDB } from "../lib/db";
import { cacheGeminiKey, clearGeminiKey, hasGeminiKey } from "../lib/geminiKeyStore";
import { getGroqKey, saveGroqKey, clearGroqKey, hasGroqKey, getOpenRouterKey, saveOpenRouterKey, clearOpenRouterKey, hasOpenRouterKey, getCohereKey, saveCohereKey, clearCohereKey, hasCohereKey, getPrimaryApi, savePrimaryApi, type PrimaryApi, getGroqModel, saveGroqModel, getOpenRouterModel, saveOpenRouterModel, getGeminiModel, saveGeminiModel, getCohereModel, saveCohereModel } from "../lib/settingsStore";
import { getGroqModelsList } from "../lib/groqGenerator";
import { getOpenRouterModelsList } from "../lib/openRouterGenerator";
import { getGeminiModelsList } from "../lib/geminiGenerator";
import { getCohereModelsList } from "../lib/cohereGenerator";

// Event install PWA (belum ada di lib DOM TypeScript)
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Profile() {
  const { user, logout, refreshUser } = useUser();
  const navigate = useNavigate();

  // Gemini API Key state
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Groq API Key state
  const [groqInput, setGroqInput] = useState("");
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqSaving, setGroqSaving] = useState(false);
  const [groqSaved, setGroqSaved] = useState(false);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [currentHasGroq, setCurrentHasGroq] = useState(false);
  const [maskedGroq, setMaskedGroq] = useState<string | null>(null);

  // OpenRouter API Key state
  const [openRouterInput, setOpenRouterInput] = useState("");
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [openRouterSaving, setOpenRouterSaving] = useState(false);
  const [openRouterSaved, setOpenRouterSaved] = useState(false);
  const [openRouterError, setOpenRouterError] = useState<string | null>(null);
  const [currentHasOpenRouter, setCurrentHasOpenRouter] = useState(false);
  const [maskedOpenRouter, setMaskedOpenRouter] = useState<string | null>(null);

  // Primary API state
  const [primaryApi, setPrimaryApiState] = useState<PrimaryApi>("gemini");

  // Model Selection State
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>("auto");

  const [groqModels, setGroqModels] = useState<string[]>([]);
  const [loadingGroqModels, setLoadingGroqModels] = useState(false);
  const [selectedGroqModel, setSelectedGroqModel] = useState<string>("auto");

  const [openRouterModels, setOpenRouterModels] = useState<string[]>([]);
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>("auto");

  // --- Cohere State ---
  const [cohereInput, setCohereInput] = useState("");
  const [currentHasCohere, setCurrentHasCohere] = useState(false);
  const [maskedCohere, setMaskedCohere] = useState<string | null>(null);
  const [cohereSaved, setCohereSaved] = useState(false);
  const [cohereModels, setCohereModels] = useState<string[]>([]);
  const [loadingCohereModels, setLoadingCohereModels] = useState(false);
  const [selectedCohereModel, setSelectedCohereModel] = useState<string>("auto");

  const currentHasKey = user ? hasGeminiKey(user.id, user.gemini_api_key) : false;
  const storedKey = user?.gemini_api_key || "";
  const maskedKey = storedKey.length > 10
    ? storedKey.slice(0, 8) + "••••••••" + storedKey.slice(-4)
    : null;

  useEffect(() => {
    if (user) {
      if (user.gemini_api_key && user.gemini_api_key.length > 10) {
        setSelectedGeminiModel(getGeminiModel(user.id) || "auto");
        setLoadingGeminiModels(true);
        getGeminiModelsList(user.gemini_api_key).then(models => {
          setGeminiModels(models);
          setLoadingGeminiModels(false);
        });
      }

      const gKey = getGroqKey(user.id);
      setCurrentHasGroq(!!gKey && gKey.length > 10);
      setMaskedGroq(gKey && gKey.length > 10 ? gKey.slice(0, 8) + "••••••••" + gKey.slice(-4) : null);
      setSelectedGroqModel(getGroqModel(user.id) || "auto");
      if (gKey && gKey.length > 10) {
        setLoadingGroqModels(true);
        getGroqModelsList(gKey).then(models => {
          setGroqModels(models);
          setLoadingGroqModels(false);
        });
      }
      
      const oKey = getOpenRouterKey(user.id);
      setCurrentHasOpenRouter(!!oKey && oKey.length > 10);
      setMaskedOpenRouter(oKey && oKey.length > 10 ? oKey.slice(0, 8) + "••••••••" + oKey.slice(-4) : null);
      setSelectedOpenRouterModel(getOpenRouterModel(user.id) || "auto");
      if (oKey && oKey.length > 10) {
        setLoadingOpenRouterModels(true);
        getOpenRouterModelsList(oKey).then(models => {
          setOpenRouterModels(models);
          setLoadingOpenRouterModels(false);
        });
      }
      
      const cKey = getCohereKey(user.id);
      setCurrentHasCohere(!!cKey && cKey.length > 10);
      setMaskedCohere(cKey && cKey.length > 10 ? cKey.slice(0, 8) + "••••••••" + cKey.slice(-4) : null);
      setSelectedCohereModel(getCohereModel(user.id) || "auto");
      if (cKey && cKey.length > 10) {
        setLoadingCohereModels(true);
        getCohereModelsList(cKey).then(models => {
          setCohereModels(models);
          setLoadingCohereModels(false);
        });
      }

      setPrimaryApiState(getPrimaryApi(user.id));
    }
  }, [user]);

  const handleSaveKey = async () => {
    if (!user) return;
    const trimmed = keyInput.trim();
    if (trimmed.length < 20) {
      setKeyError("API key terlalu pendek. Pastikan Anda menyalin key yang lengkap.");
      return;
    }
    setSaving(true);
    setKeyError(null);
    try {
      await saveGeminiKeyToDB(user.id, trimmed);
      cacheGeminiKey(user.id, trimmed);
      await refreshUser(); 
      setKeyInput("");
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2500);
      
      setLoadingGeminiModels(true);
      getGeminiModelsList(trimmed).then(models => {
        setGeminiModels(models);
        setLoadingGeminiModels(false);
      });
    } catch {
      setKeyError("Gagal menyimpan API key. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!user) return;
    try {
      await clearGeminiKeyFromDB(user.id);
      clearGeminiKey(user.id);
      await refreshUser();
      setKeyInput("");
      if (primaryApi === "gemini") {
          if (currentHasGroq) handleSetPrimary("groq");
          else if (currentHasOpenRouter) handleSetPrimary("openrouter");
      }
    } catch {
      setKeyError("Gagal menghapus API key.");
    }
  };

  const handleSaveGroq = async () => {
    if (!user) return;
    const trimmed = groqInput.trim();
    if (trimmed.length < 20) {
      setGroqError("API key terlalu pendek. Pastikan Anda menyalin key yang lengkap.");
      return;
    }
    setGroqSaving(true);
    setGroqError(null);
    try {
      saveGroqKey(user.id, trimmed);
      setCurrentHasGroq(true);
      setMaskedGroq(trimmed.slice(0, 8) + "••••••••" + trimmed.slice(-4));
      setGroqInput("");
      setGroqSaved(true);
      setTimeout(() => setGroqSaved(false), 2500);
      
      // Fetch models
      setLoadingGroqModels(true);
      getGroqModelsList(trimmed).then(models => {
        setGroqModels(models);
        setLoadingGroqModels(false);
      });
    } catch {
      setGroqError("Gagal menyimpan Groq API key.");
    } finally {
      setGroqSaving(false);
    }
  };

  const handleDeleteGroq = () => {
    if (!user) return;
    clearGroqKey(user.id);
    setCurrentHasGroq(false);
    setMaskedGroq(null);
    if (primaryApi === "groq") {
        if (currentHasKey) handleSetPrimary("gemini");
        else if (currentHasOpenRouter) handleSetPrimary("openrouter");
    }
  };

  const handleSaveOpenRouter = async () => {
    if (!user) return;
    const trimmed = openRouterInput.trim();
    if (trimmed.length < 20) {
      setOpenRouterError("API key terlalu pendek. Pastikan Anda menyalin key yang lengkap.");
      return;
    }
    setOpenRouterSaving(true);
    setOpenRouterError(null);
    try {
      saveOpenRouterKey(user.id, trimmed);
      setCurrentHasOpenRouter(true);
      setMaskedOpenRouter(trimmed.slice(0, 8) + "••••••••" + trimmed.slice(-4));
      setOpenRouterInput("");
      setOpenRouterSaved(true);
      setTimeout(() => setOpenRouterSaved(false), 2500);
      
      // Fetch models
      setLoadingOpenRouterModels(true);
      getOpenRouterModelsList(trimmed).then(models => {
        setOpenRouterModels(models);
        setLoadingOpenRouterModels(false);
      });
    } catch {
      setOpenRouterError("Gagal menyimpan OpenRouter API key.");
    } finally {
      setOpenRouterSaving(false);
    }
  };

  const handleDeleteOpenRouter = () => {
    if (!user) return;
    clearOpenRouterKey(user.id);
    setCurrentHasOpenRouter(false);
    setMaskedOpenRouter(null);
    if (primaryApi === "openrouter") {
        if (currentHasKey) handleSetPrimary("gemini");
        else if (currentHasGroq) handleSetPrimary("groq");
        else if (currentHasCohere) handleSetPrimary("cohere");
    }
  };

  const handleSaveCohere = async () => {
    if (!user) return;
    const trimmed = cohereInput.trim();
    if (trimmed.length < 20) {
      alert("API key terlalu pendek. Pastikan Anda menyalin key yang lengkap.");
      return;
    }
    saveCohereKey(user.id, trimmed);
    setCurrentHasCohere(true);
    setMaskedCohere(trimmed.slice(0, 8) + "••••••••" + trimmed.slice(-4));
    setCohereInput("");
    setCohereSaved(true);
    setTimeout(() => setCohereSaved(false), 2500);
    
    setLoadingCohereModels(true);
    getCohereModelsList(trimmed).then(models => {
      setCohereModels(models);
      setLoadingCohereModels(false);
    });
  };

  const handleDeleteCohere = () => {
    if (!user) return;
    clearCohereKey(user.id);
    setCurrentHasCohere(false);
    setMaskedCohere(null);
    if (primaryApi === "cohere") {
        if (currentHasKey) handleSetPrimary("gemini");
        else if (currentHasGroq) handleSetPrimary("groq");
        else if (currentHasOpenRouter) handleSetPrimary("openrouter");
    }
  };

  const handleSetPrimary = (api: PrimaryApi) => {
    if (!user) return;
    savePrimaryApi(user.id, api);
    setPrimaryApiState(api);
  };

  const handleGeminiModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    const model = e.target.value;
    setSelectedGeminiModel(model);
    if (model === "auto") {
      saveGeminiModel(user.id, ""); 
    } else {
      saveGeminiModel(user.id, model);
    }
  };

  const handleGroqModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    const model = e.target.value;
    setSelectedGroqModel(model);
    if (model === "auto") {
      saveGroqModel(user.id, ""); // Kosongkan agar auto-discovery
    } else {
      saveGroqModel(user.id, model);
    }
  };

  const handleOpenRouterModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    const model = e.target.value;
    setSelectedOpenRouterModel(model);
    if (model === "auto") {
      saveOpenRouterModel(user.id, ""); // Kosongkan agar auto-fallback
    } else {
      saveOpenRouterModel(user.id, model);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // ── PWA: pasang aplikasi ──
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setIsStandalone(mq.matches);
    updateStandalone();
    mq.addEventListener?.("change", updateStandalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      mq.removeEventListener?.("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader title="Profil" back={false} />

      {/* Google Profile Card */}
      <div className="card mb-5 p-5">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary-100"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-xl font-bold text-primary-700">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-neutral-800">{user.username}</p>
            <p className="text-sm text-neutral-400">
              Pengguna sejak {new Date(user.created_at).toLocaleDateString("id-ID")}
            </p>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
              Login via Google
            </div>
          </div>
        </div>
      </div>

      {/* AI Preferences */}
      {(currentHasKey || currentHasGroq || currentHasOpenRouter) && (
        <div className="card mb-5 p-5 bg-primary-50 border-primary-200">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary-800">
            <Star size={18} className="text-primary-500" /> Pilihan API Key
          </h2>
          <p className="mb-4 text-xs text-primary-700">
            Hanya API yang dipilih di bawah ini yang akan digunakan saat pembuatan soal. Pilih "Matikan AI" jika Anda ingin membuat soal biasa tanpa API Key (Rule-based).
          </p>
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">

             <button 
               onClick={() => handleSetPrimary("groq")}
               disabled={!currentHasGroq}
               className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl border text-sm font-semibold transition ${
                 primaryApi === "groq" ? "bg-primary-600 text-white border-primary-600 shadow-md" : 
                 !currentHasGroq ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed" :
                 "bg-white text-primary-700 border-primary-200 hover:bg-primary-100"
               }`}
             >
               Groq
             </button>
             <button 
               onClick={() => handleSetPrimary("openrouter")}
               disabled={!currentHasOpenRouter}
               className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl border text-sm font-semibold transition ${
                 primaryApi === "openrouter" ? "bg-primary-600 text-white border-primary-600 shadow-md" : 
                 !currentHasOpenRouter ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed" :
                 "bg-white text-primary-700 border-primary-200 hover:bg-primary-100"
               }`}
             >
               OpenRouter
             </button>
             <button 
               onClick={() => handleSetPrimary("cohere")}
               disabled={!currentHasCohere}
               className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl border text-sm font-semibold transition ${
                 primaryApi === "cohere" ? "bg-primary-600 text-white border-primary-600 shadow-md" : 
                 !currentHasCohere ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed" :
                 "bg-white text-primary-700 border-primary-200 hover:bg-primary-100"
               }`}
             >
               Cohere
             </button>
             <button 
               onClick={() => handleSetPrimary("none")}
               className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl border text-sm font-semibold transition ${
                 primaryApi === "none" ? "bg-neutral-600 text-white border-neutral-600 shadow-md" : 
                 "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
               }`}
             >
               Matikan AI
             </button>
          </div>
        </div>
      )}


      {/* Groq API Key */}
      <div className="card mb-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-neutral-700">
          <Key size={18} className="text-amber-500" /> Groq API Key
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Key hanya disimpan di browser perangkat ini (Local Storage). Groq menawarkan inferensi yang sangat cepat.{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-amber-600 hover:underline"
          >
            Dapatkan Groq key gratis <ExternalLink size={11} />
          </a>
        </p>

        {currentHasGroq ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-success-50 border border-success-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-success-700">✅ API Key Tersimpan</p>
                <p className="mt-0.5 font-mono text-xs text-success-600">{maskedGroq}</p>
              </div>
              <button
                onClick={handleDeleteGroq}
                className="ml-3 flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-100 transition"
              >
                <Trash2 size={13} /> Hapus
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-neutral-700 mb-2">Model Groq (Opsional)</label>
              {loadingGroqModels ? (
                <div className="text-xs text-neutral-500 flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Memuat daftar model...
                </div>
              ) : (
                <select 
                  className="input w-full text-sm py-2" 
                  value={selectedGroqModel} 
                  onChange={handleGroqModelChange}
                >
                  <option value="auto">Auto-Discovery (Otomatis Pilih Terbaik)</option>
                  {groqModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        ) : (
          <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-xs text-neutral-600">Belum ada API Key</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="relative">
            <input
              type={showGroqKey ? "text" : "password"}
              className="input pr-10 font-mono text-sm"
              placeholder="gsk_..."
              value={groqInput}
              onChange={(e) => { setGroqInput(e.target.value); setGroqError(null); }}
            />
            <button
              type="button"
              onClick={() => setShowGroqKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {groqError && <p className="text-xs text-error-600">{groqError}</p>}
          {groqSaved && <p className="text-xs font-semibold text-success-600">✅ Disimpan!</p>}
          <button
            onClick={handleSaveGroq}
            disabled={!groqInput.trim() || groqSaving}
            className="btn-primary w-full disabled:opacity-50"
          >
            {groqSaving ? <><RefreshCw size={16} className="animate-spin" /> Menyimpan...</> : <><Check size={16} /> Simpan Groq Key</>}
          </button>
        </div>
      </div>

      {/* OpenRouter API Key */}
      <div className="card mb-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-neutral-700">
          <Key size={18} className="text-purple-500" /> OpenRouter API Key
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Dapatkan akses ke puluhan model open-source gratis (Llama, Gemma, dll).{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-purple-600 hover:underline"
          >
            Dapatkan OpenRouter key gratis <ExternalLink size={11} />
          </a>
        </p>

        {currentHasOpenRouter ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-success-50 border border-success-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-success-700">✅ API Key Tersimpan</p>
                <p className="mt-0.5 font-mono text-xs text-success-600">{maskedOpenRouter}</p>
              </div>
              <button
                onClick={handleDeleteOpenRouter}
                className="ml-3 flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-100 transition"
              >
                <Trash2 size={13} /> Hapus
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-neutral-700 mb-2">Model OpenRouter (Opsional)</label>
              {loadingOpenRouterModels ? (
                <div className="text-xs text-neutral-500 flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Memuat daftar model...
                </div>
              ) : (
                <select 
                  className="input w-full text-sm py-2" 
                  value={selectedOpenRouterModel} 
                  onChange={handleOpenRouterModelChange}
                >
                  <option value="auto">Auto-Fallback (Otomatis Cari Yang Kosong)</option>
                  {openRouterModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        ) : (
          <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-xs text-neutral-600">Belum ada API Key</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="relative">
            <input
              type={showOpenRouterKey ? "text" : "password"}
              className="input pr-10 font-mono text-sm"
              placeholder="sk-or-v1-..."
              value={openRouterInput}
              onChange={(e) => { setOpenRouterInput(e.target.value); setOpenRouterError(null); }}
            />
            <button
              type="button"
              onClick={() => setShowOpenRouterKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {openRouterError && <p className="text-xs text-error-600">{openRouterError}</p>}
          {openRouterSaved && <p className="text-xs font-semibold text-success-600">✅ Disimpan!</p>}
          <button
            onClick={handleSaveOpenRouter}
            disabled={!openRouterInput.trim() || openRouterSaving}
            className="btn-primary w-full disabled:opacity-50 !bg-purple-600 hover:!bg-purple-700 !border-purple-700"
          >
            {openRouterSaving ? <><RefreshCw size={16} className="animate-spin" /> Menyimpan...</> : <><Check size={16} /> Simpan OpenRouter Key</>}
          </button>
        </div>
      </div>

      {/* Cohere API Key */}
      <div className="card mb-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-neutral-700">
          <Key size={18} className="text-teal-500" /> Cohere API Key
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Trial Key Cohere gratis selamanya dan sangat pintar (Command R).{" "}
          <a
            href="https://dashboard.cohere.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-teal-600 hover:underline"
          >
            Dapatkan Cohere key gratis <ExternalLink size={11} />
          </a>
        </p>

        {currentHasCohere ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl bg-success-50 border border-success-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-success-700">✅ API Key Tersimpan</p>
                <p className="mt-0.5 font-mono text-xs text-success-600">{maskedCohere}</p>
              </div>
              <button
                onClick={handleDeleteCohere}
                className="ml-3 flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-100 transition"
              >
                <Trash2 size={13} /> Hapus
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-neutral-700 mb-2">Model Cohere (Opsional)</label>
              {loadingCohereModels ? (
                <div className="text-xs text-neutral-500 flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Memuat daftar model...
                </div>
              ) : (
                <select 
                  className="input w-full text-sm py-2" 
                  value={selectedCohereModel} 
                  onChange={(e) => {
                    setSelectedCohereModel(e.target.value);
                    if (user) saveCohereModel(user.id, e.target.value);
                  }}
                >
                  <option value="auto">Auto (Command-R)</option>
                  {cohereModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        ) : (
          <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-xs text-neutral-600">Belum ada API Key</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              className="input pr-10 font-mono text-sm"
              placeholder="Your Cohere API Key..."
              value={cohereInput}
              onChange={(e) => { setCohereInput(e.target.value); }}
            />
          </div>
          {cohereSaved && <p className="text-xs font-semibold text-success-600">✅ Disimpan!</p>}
          <button
            onClick={handleSaveCohere}
            disabled={!cohereInput.trim()}
            className="btn-primary w-full disabled:opacity-50 !bg-teal-600 hover:!bg-teal-700 !border-teal-700"
          >
            <Check size={16} /> Simpan Cohere Key
          </button>
        </div>
      </div>

      {/* Pasang Aplikasi (PWA) */}
      <div className="card mb-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-neutral-700">
          <Smartphone size={18} className="text-primary-500" /> Pasang Aplikasi
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
          Install Quiz Simulator sebagai aplikasi agar shortcut muncul di desktop / beranda HP — terbuka lebih cepat, seperti aplikasi biasa.
        </p>
        {isStandalone ? (
          <div className="rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-sm font-semibold text-success-700">
            ✓ Aplikasi sudah terpasang
          </div>
        ) : installPrompt ? (
          <button onClick={handleInstall} className="btn-primary w-full">
            <Download size={16} /> Install Aplikasi
          </button>
        ) : (
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-xs leading-5 text-neutral-600">
            Di perangkat ini gunakan menu browser: <b>Chrome → ⋮ → "Install aplikasi"</b> atau <b>iPhone/Safari → Bagikan → "Tambahkan ke Layar Utama"</b>.
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="btn-secondary w-full !text-error-600 !border-error-200 hover:!bg-error-50"
      >
        <LogOut size={18} /> Keluar dari Akun Google
      </button>

      <p className="mt-6 text-center text-xs text-neutral-300">Quiz Simulator v0.2</p>
      <div className="h-4" />
    </div>
  );
}

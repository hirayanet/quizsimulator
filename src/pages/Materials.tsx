import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  FolderOpen,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  History,
  Loader2,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { getMaterialsByUser, deleteMaterial } from "../lib/db";
import type { Material } from "../types";
import { formatFileSize, formatDate } from "../lib/utils";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { Toast } from "../components/Toast";

export default function Materials() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    getMaterialsByUser(user.id)
      .then(setMaterials)
      .catch(() => setError("Gagal memuat materi."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMaterial(deleteTarget.id);
      setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Gagal menghapus materi.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const totalQuizzes = materials.reduce((sum, m) => sum + m.quiz_count, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:py-8">
      <PageHeader
        title="Materi Saya"
        subtitle={`${materials.length} materi tersimpan · ${totalQuizzes} quiz dibuat`}
        backTo="/"
        right={
          <button onClick={() => navigate("/create")} className="btn-primary !px-4 !py-2.5">
            <Plus size={18} /> Upload
          </button>
        }
      />

      {/* Summary strip */}
      <section className="card-elevated relative mb-6 overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* Icon + intro text: biarkan teks memakai sisa ruang agar tidak terjepit */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-glow">
              <FolderOpen size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">Perpustakaan materi</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Kelola materi pembelajaran dan buat quiz baru kapan saja.
              </p>
            </div>
          </div>

          {/* Statistik: dua kolom penuh di mobile, menyamping di layar lebih lebar */}
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div className="glass-panel px-4 py-3 text-center">
              <p className="text-lg font-bold leading-tight text-neutral-800">{materials.length}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Materi</p>
            </div>
            <div className="glass-panel px-4 py-3 text-center">
              <p className="text-lg font-bold leading-tight text-neutral-800">{totalQuizzes}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Quiz</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-5">
          <Toast message={error} type="error" />
        </div>
      )}

      {materials.length === 0 ? (
        <div className="card-elevated">
          <EmptyState
            icon={<FolderOpen size={28} />}
            title="Belum ada materi"
            description="Upload materi untuk mulai membuat quiz."
            action={
              <button onClick={() => navigate("/create")} className="btn-primary">
                <Plus size={18} /> Upload Materi
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {materials.map((m) => (
            <div key={m.id} className="card card-hover p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-primary-50 to-white text-primary-600 ring-1 ring-primary-100">
                  <FileText size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-800" title={m.filename}>
                    {m.filename}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MetaPill>{m.file_type.toUpperCase()}</MetaPill>
                    <MetaPill>{formatFileSize(m.file_size)}</MetaPill>
                    <MetaPill>{formatDate(m.created_at)}</MetaPill>
                    {m.quiz_count > 0 && (
                      <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-600 ring-1 ring-primary-100">
                        {m.quiz_count} quiz
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                    className="rounded-xl p-1.5 text-neutral-400 transition hover:bg-white hover:text-neutral-700 hover:shadow-soft"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuOpen === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-9 z-20 w-48 rounded-2xl border border-white/70 bg-white/95 py-2 shadow-lift backdrop-blur-xl animate-pop">
                        <button
                          onClick={() => { setMenuOpen(null); navigate(`/quiz/config/${m.id}`); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-primary-50 hover:text-primary-700"
                        >
                          <RefreshCw size={16} /> Buat Quiz
                        </button>
                        <button
                          onClick={() => { setMenuOpen(null); navigate("/history"); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-primary-50 hover:text-primary-700"
                        >
                          <History size={16} /> Lihat History
                        </button>
                        <div className="my-1.5 h-px bg-neutral-100" />
                        <button
                          onClick={() => { setMenuOpen(null); setDeleteTarget(m); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-error-600 transition hover:bg-error-50"
                        >
                          <Trash2 size={16} /> Hapus Materi
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/quiz/config/${m.id}`)}
                  className="btn-primary flex-1 !py-2.5"
                >
                  <Plus size={16} /> Buat Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Materi?"
      >
        <p className="mb-5 text-sm leading-6 text-neutral-600">
          Yakin ingin menghapus "{deleteTarget?.filename}"? Semua quiz dan soal dari materi ini juga akan dihapus.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1" disabled={deleting}>
            Batal
          </button>
          <button onClick={handleDelete} className="btn-primary flex-1" disabled={deleting}>
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
      {children}
    </span>
  );
}

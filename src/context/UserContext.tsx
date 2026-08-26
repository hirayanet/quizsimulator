import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase, signOut as supabaseSignOut } from "../lib/supabase";
import { syncUserProfile, getUserById } from "../lib/db";
import { clearLocalCache } from "../lib/geminiKeyStore";
import type { User } from "../types";

interface UserContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** Muat ulang data user dari DB (dipanggil setelah update profil/API key) */
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const profile = await getUserById(session.user.id);
    if (profile) setUser(profile);
  };

  useEffect(() => {
    // Cek sesi yang sudah ada (misal: refresh halaman setelah login)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await handleAuthUser(session.user);
      }
      setLoading(false);
    });

    // Dengarkan perubahan sesi (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setLoading(true);
          await handleAuthUser(session.user);
          setLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Token diperbarui — pastikan profil masih ada
          const profile = await getUserById(session.user.id);
          if (profile) setUser(profile);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sinkronisasi profil Google ke tabel users kita.
   * Gunakan data dari Google (nama, foto) untuk mengisi profil.
   */
  async function handleAuthUser(authUser: { id: string; email?: string; user_metadata?: Record<string, string> }) {
    try {
      const meta = authUser.user_metadata || {};
      const displayName =
        meta.full_name || meta.name || authUser.email?.split("@")[0] || "User";
      const avatarUrl = meta.avatar_url || meta.picture || undefined;
      const email = authUser.email || "";

      const profile = await syncUserProfile(
        authUser.id,
        email,
        displayName,
        avatarUrl,
      );
      setUser(profile);
    } catch (err) {
      console.error("[Auth] Gagal sync profil:", err);
      setUser(null);
    }
  }

  const logout = async () => {
    if (user) clearLocalCache(user.id);
    await supabaseSignOut();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

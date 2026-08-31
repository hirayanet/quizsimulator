import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, FolderOpen, History, BarChart3, User } from "lucide-react";
import { useUser } from "../context/UserContext";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/materials", label: "Materi", icon: FolderOpen },
  { path: "/history", label: "History", icon: History },
  { path: "/statistics", label: "Statistik", icon: BarChart3 },
  { path: "/profile", label: "Profil", icon: User },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  // Hide bottom nav on quiz play and result pages for focus, or if user is not logged in
  const hideNav = !user || location.pathname.startsWith("/quiz/play") || location.pathname.startsWith("/quiz/result");

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(circle_at_top,rgba(31,116,240,0.14),transparent_62%)]" />

      <div className={hideNav ? "" : "lg:pl-72"}>
        <div className="safe-top pb-24 lg:pb-0">
          <Outlet />
        </div>
        {!hideNav && <div className="h-24 lg:hidden" />}
      </div>

      {!hideNav && (
        <nav className="fixed bottom-4 left-0 right-0 z-40 safe-bottom lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-around px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <div key={item.path} className="flex-1">
                  <button
                    onClick={() => navigate(item.path)}
                    className={`flex w-full flex-col items-center gap-1 rounded-2xl py-2 transition ${
                      active
                        ? "bg-gradient-to-b from-primary-50 to-white text-primary-700 shadow-soft"
                        : "text-neutral-400"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.6 : 2} />
                    <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                      {item.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-0 -z-10 mx-auto h-[74px] max-w-md rounded-[28px] border border-white/70 bg-white/84 shadow-float backdrop-blur-xl" />
        </nav>
      )}

      {/* Desktop sidebar */}
      {!hideNav && (
        <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-white/70 bg-white/72 backdrop-blur-xl lg:block">
          <div className="no-scrollbar flex h-full flex-col overflow-y-auto p-4">
            <div className="mb-5 rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 p-4 text-white shadow-glow">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 text-white backdrop-blur">
                <BarChart3 size={18} />
              </div>
              <p className="text-xs font-medium text-white/78">Quiz Simulator</p>
              <span className="text-lg font-bold leading-snug">Belajar Lebih Interaktif</span>
            </div>

            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-gradient-to-r from-primary-50 to-white text-primary-700 shadow-soft"
                        : "text-neutral-500 hover:bg-white/90 hover:text-neutral-700"
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-3xl border border-white/60 bg-white/84 p-3.5 shadow-card backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 text-sm font-bold text-white shadow-soft">
                  {user?.username?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-700">{user?.username || "Tamu"}</p>
                  <p className="text-xs text-neutral-400">Status pengguna</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

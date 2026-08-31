import { Routes, Route, Navigate } from "react-router-dom";
import { useUser } from "./context/UserContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateQuiz from "./pages/CreateQuiz";
import QuizConfig from "./pages/QuizConfig";
import QuizPlay from "./pages/QuizPlay";
import QuizResult from "./pages/QuizResult";
import QuizReview from "./pages/QuizReview";
import Materials from "./pages/Materials";
import History from "./pages/History";
import HistoryDetail from "./pages/HistoryDetail";
import Statistics from "./pages/Statistics";
import Profile from "./pages/Profile";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/materials" element={<Protected><Materials /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/history/:quizId" element={<Protected><HistoryDetail /></Protected>} />
          <Route path="/statistics" element={<Protected><Statistics /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/create" element={<Protected><CreateQuiz /></Protected>} />
          <Route path="/quiz/config/:materialId" element={<Protected><QuizConfig /></Protected>} />
          <Route path="/quiz/play/:quizId" element={<Protected><QuizPlay /></Protected>} />
          <Route path="/quiz/result/:quizId" element={<Protected><QuizResult /></Protected>} />
          <Route path="/quiz/review/:quizId" element={<Protected><QuizReview /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

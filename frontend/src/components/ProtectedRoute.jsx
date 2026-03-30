import { Navigate } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthContext();

  if (loading) return <p>Загрузка...</p>;
  if (!user?.id) return <Navigate to="/login" replace />;

  return children;
}

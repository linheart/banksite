import { Navigate } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";

export default function RoleRoute({ children, allowedRoles = [] }) {
  const { user, role, loading } = useAuthContext();

  if (loading) return <p>Загрузка...</p>;
  if (!user?.id) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

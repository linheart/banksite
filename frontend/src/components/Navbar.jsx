import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";

export default function Navbar() {
  const navigate = useNavigate();
  const { role, clearUser } = useAuthContext();

  const handleLogout = async () => {
    await axios.post("/api/logout", {}, { withCredentials: true });
    clearUser();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <Link to="/">
        <div className="topbar__brand">
          <div className="logo">⚙️</div>
          <div className="title">
            <div className="title-main">Config Control</div>
            <div className="title-sub">Аудит конфигурации сети</div>
          </div>
        </div>
      </Link>
      <div className="topbar__actions">
        {role === "admin" ? (
          <Link to="/access" className="topbar__link">
            Доступы
          </Link>
        ) : null}
        <button onClick={handleLogout}>Выйти</button>
      </div>
    </header>
  );
}

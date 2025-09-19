import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await axios.post("/api/logout", {}, { withCredentials: true });
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
      <button onClick={handleLogout}>Выйти</button>
    </header>
  );
}

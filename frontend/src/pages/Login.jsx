import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuthContext } from "../components/AuthProvider";
import { showToast } from "../components/toastBus";

export default function Login() {
  const navigate = useNavigate();
  const { refreshUser } = useAuthContext();
  const [formData, setFormData] = useState({ username: "", password: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/login", formData, { withCredentials: true });
      await refreshUser();
      navigate("/");
    } catch (err) {
      if (err?.response?.data?.detail === "invalid credentials") {
        showToast("Неверный логин или пароль");
        return;
      }
      showToast("Ошибка входа");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Вход</h2>
        <form onSubmit={handleSubmit}>
          <label>Имя</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />

          <label>Пароль</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit">Войти</button>
        </form>
        <p className="redirect">
          Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
        </p>
      </div>
    </div>
  );
}

import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { showToast } from "../components/toastBus";

const FIELD_LABELS = {
  username: "Имя",
  email: "Почта",
  password: "Пароль",
};

const DETAIL_TRANSLATIONS = {
  "Username already exists": "Пользователь с таким именем уже зарегистрирован",
  "Email already exists": "Пользователь с такой почтой уже зарегистрирован",
  "User already exists": "Пользователь уже существует",
};

function translateField(field) {
  return FIELD_LABELS[field] || field || "Поле";
}

function translateValidationItem(item) {
  const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : "";
  const fieldLabel = translateField(field);
  const type = item?.type;
  const msg = item?.msg || "";

  if (type === "string_too_short") {
    return `${fieldLabel}: минимум ${item?.ctx?.min_length ?? ""} символов`.trim();
  }

  if (type === "string_too_long") {
    return `${fieldLabel}: максимум ${item?.ctx?.max_length ?? ""} символов`.trim();
  }

  return `${fieldLabel}: некорректное значение`;
}

function extractErrorMessage(err) {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => translateValidationItem(item))
      .filter(Boolean);

    if (messages.length > 0) return messages.join("; ");
  }

  if (typeof detail === "string" && detail.trim()) {
    return DETAIL_TRANSLATIONS[detail] || "Ошибка регистрации";
  }

  if (err?.message === "Network Error") {
    return "Сервер недоступен";
  }

  return "Ошибка регистрации";
}

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/register", formData, { withCredentials: true });
      navigate("/login");
    } catch (err) {
      showToast(extractErrorMessage(err));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Регистрация</h2>
        <form onSubmit={handleSubmit}>
          <label>Имя</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />

          <label>Почта</label>
          <input
            type="email"
            name="email"
            value={formData.email}
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

          <button type="submit">Зарегистрироваться</button>
        </form>
        <p className="redirect">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}

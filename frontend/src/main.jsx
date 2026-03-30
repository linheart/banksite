import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import App from "./App";
import { AuthProvider } from "./components/AuthProvider";
import ToastHost from "./components/ToastHost";
import { queueToastForNextPage, showToast } from "./components/toastBus";
import "./index.css";

axios.defaults.withCredentials = true;

let refreshPromise = null;
let lastAuthNoticeAt = 0;
const AUTH_HINT_KEY = "auth_hint";

function getAuthHint() {
  try {
    return localStorage.getItem(AUTH_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function setAuthHint(value) {
  try {
    if (value) {
      localStorage.setItem(AUTH_HINT_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_HINT_KEY);
    }
  } catch {}
}

function isPublicPath(pathname) {
  return pathname === "/login" || pathname === "/register";
}

function handleAuthExpired(showNotice = true) {
  const now = Date.now();
  if (now - lastAuthNoticeAt <= 2000) return;
  lastAuthNoticeAt = now;

  if (!isPublicPath(window.location.pathname)) {
    if (showNotice) {
      queueToastForNextPage("Сессия истекла. Войдите снова.");
    }
    window.location.assign("/login");
    return;
  }
  if (showNotice) {
    showToast("Сессия истекла. Войдите снова.");
  }
}

axios.interceptors.response.use(
  (response) => {
    const url = response?.config?.url || "";
    if (
      url.includes("/api/login") ||
      url.includes("/api/me") ||
      url.includes("/api/token/refresh")
    ) {
      setAuthHint(true);
    } else if (url.includes("/api/logout")) {
      setAuthHint(false);
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const url = originalRequest?.url || "";
    const isLoginRequest = url.includes("/api/login");
    const isRegisterRequest = url.includes("/api/register");
    const isRefreshRequest = url.includes("/api/token/refresh");
    const hasAuthHint = getAuthHint();

    if (
      status === 401 &&
      hasAuthHint &&
      originalRequest &&
      !originalRequest._retry &&
      !isLoginRequest &&
      !isRegisterRequest &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = axios.post("/api/token/refresh", {}).finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        return axios(originalRequest);
      } catch (refreshError) {
        setAuthHint(false);
        handleAuthExpired(true);
        return Promise.reject(refreshError);
      }
    }

    if (
      status === 401 &&
      !isLoginRequest &&
      !isRegisterRequest &&
      !isRefreshRequest
    ) {
      handleAuthExpired(hasAuthHint);
    } else if (status === 403) {
      showToast("Недостаточно прав для выполнения операции");
    } else if (!status) {
      if (!isLoginRequest && !isRegisterRequest) {
        showToast("Сервер недоступен");
      }
    } else if (status >= 500) {
      if (!isLoginRequest && !isRegisterRequest) {
        showToast("Ошибка сервера.");
      }
    }

    return Promise.reject(error);
  },
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <ToastHost />
    </AuthProvider>
  </BrowserRouter>,
);

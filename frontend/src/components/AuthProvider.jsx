import axios from "axios";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const AuthContext = createContext(null);

function isPublicPath(pathname) {
  return pathname === "/login" || pathname === "/register";
}

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshPromiseRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(() => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    setLoading(true);
    const request = axios
      .get("/api/me")
      .then((res) => {
        const nextUser = res.data || null;
        setUser(nextUser);
        return nextUser;
      })
      .catch((err) => {
        if (err?.response?.status === 401) {
          setUser(null);
          return null;
        }
        return userRef.current;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
        setLoading(false);
      });

    refreshPromiseRef.current = request;
    return request;
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setLoading(false);
      return;
    }

    if (user?.id) {
      setLoading(false);
      return;
    }

    refreshUser();
  }, [pathname, refreshUser, user]);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || "",
      loading,
      refreshUser,
      clearUser,
    }),
    [clearUser, loading, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      role: "",
      loading: false,
      refreshUser: async () => null,
      clearUser: () => {},
    };
  }
  return context;
}

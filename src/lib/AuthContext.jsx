import React, { createContext, useContext, useEffect, useState } from "react";
import { appClient, isLocalBackendEnabled } from "@/api/appClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setAuthError(null);
    setIsLoadingPublicSettings(true);
    setIsLoadingAuth(true);

    try {
      const currentUser = await appClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));
      setAppPublicSettings({
        local_backend: isLocalBackendEnabled,
      });
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: "auth_required",
        message: "Autenticação obrigatória",
      });
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    appClient.auth.logout?.();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({
      type: "auth_required",
      message: "Autenticação obrigatória",
    });
  };

  const login = async (email, password) => {
    setIsSubmittingLogin(true);
    setAuthError(null);

    try {
      const currentUser = await appClient.auth.login(email, password);
      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));
      return currentUser;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: "login_failed",
        message: error?.message || "Falha ao autenticar.",
      });
      throw error;
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const navigateToLogin = () => {
    appClient.auth.redirectToLogin?.(window.location.href);
    setAuthError({
      type: "auth_required",
      message: "Autenticação obrigatória",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        isSubmittingLogin,
        login,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};

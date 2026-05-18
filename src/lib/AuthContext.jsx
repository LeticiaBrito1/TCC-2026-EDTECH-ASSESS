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
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isSubmittingLoginCode, setIsSubmittingLoginCode] = useState(false);
  // Guarda o e-mail após cadastro para mostrar na tela de confirmação
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  // Guarda o e-mail durante o fluxo de código de login 2FA
  const [pendingLoginEmail, setPendingLoginEmail] = useState(null);

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
      setAppPublicSettings({ local_backend: isLocalBackendEnabled });
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    appClient.auth.logout?.();
    setUser(null);
    setIsAuthenticated(false);
    setPendingVerificationEmail(null);
    setPendingLoginEmail(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const register = async ({ full_name, email, password }) => {
    setIsSubmittingRegister(true);
    setAuthError(null);

    try {
      // Registro não faz login automático — apenas envia o e-mail de verificação
      await appClient.auth.register({ full_name, email, password });
      setPendingVerificationEmail(email);
      setAuthError({ type: "verify_email_pending", message: "Verifique seu e-mail." });
    } catch (error) {
      setAuthError({
        type: "register_failed",
        message: error?.message || "Falha ao criar conta.",
      });
      throw error;
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  const login = async (email, password) => {
    setIsSubmittingLogin(true);
    setAuthError(null);

    try {
      const result = await appClient.auth.login(email, password);

      // Backend retorna { step: "code_required", email } — aguarda código 2FA
      if (result?.step === "code_required") {
        setPendingLoginEmail(result.email || email);
        setAuthError({ type: "login_code_required", message: "Código enviado." });
        return null;
      }

      // Fluxo legado (não deve ocorrer, mas previne regressão)
      setUser(result);
      setIsAuthenticated(Boolean(result));
      return result;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);

      const isUnverified =
        error?.message?.toLowerCase().includes("não verificado") ||
        error?.message?.toLowerCase().includes("e-mail");

      if (isUnverified) {
        setPendingVerificationEmail(email);
        setAuthError({ type: "email_not_verified", message: error.message, email });
      } else {
        setAuthError({ type: "login_failed", message: error?.message || "Falha ao autenticar." });
      }
      throw error;
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const verifyLoginCode = async (code) => {
    if (!pendingLoginEmail) return;
    setIsSubmittingLoginCode(true);
    setAuthError(null);

    try {
      const currentUser = await appClient.auth.verifyLoginCode(pendingLoginEmail, code);
      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));
      setPendingLoginEmail(null);
      return currentUser;
    } catch (error) {
      setAuthError({ type: "login_code_failed", message: error?.message || "Código inválido." });
      throw error;
    } finally {
      setIsSubmittingLoginCode(false);
    }
  };

  const cancelLoginCode = () => {
    setPendingLoginEmail(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const navigateToLogin = () => {
    appClient.auth.redirectToLogin?.(window.location.href);
    setPendingVerificationEmail(null);
    setPendingLoginEmail(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const clearPendingVerification = () => {
    setPendingVerificationEmail(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
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
        isSubmittingRegister,
        isSubmittingLoginCode,
        pendingVerificationEmail,
        pendingLoginEmail,
        login,
        register,
        logout,
        verifyLoginCode,
        cancelLoginCode,
        navigateToLogin,
        checkAppState,
        clearPendingVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};

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
  const [isSubmittingVerifyPhone, setIsSubmittingVerifyPhone] = useState(false);
  // Guarda o telefone após cadastro para mostrar na tela de verificação
  const [pendingVerificationPhone, setPendingVerificationPhone] = useState(null);
  // Guarda email e telefone durante o fluxo de código de login 2FA
  const [pendingLoginEmail, setPendingLoginEmail] = useState(null);
  const [pendingLoginPhone, setPendingLoginPhone] = useState(null);

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
    setPendingVerificationPhone(null);
    setPendingLoginEmail(null);
    setPendingLoginPhone(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const register = async ({ full_name, email, password, phone }) => {
    setIsSubmittingRegister(true);
    setAuthError(null);

    try {
      await appClient.auth.register({ full_name, email, password, phone });
      setPendingVerificationPhone(phone);
      setAuthError({ type: "verify_phone_pending", message: "Verifique seu celular." });
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

  const verifyPhone = async (code) => {
    if (!pendingVerificationPhone) return;
    setIsSubmittingVerifyPhone(true);
    setAuthError(null);

    try {
      await appClient.auth.verifyPhone(pendingVerificationPhone, code);
      setPendingVerificationPhone(null);
      setAuthError({ type: "auth_required", message: "Conta verificada! Faça login." });
    } catch (error) {
      setAuthError({ type: "verify_phone_failed", message: error?.message || "Código inválido." });
      throw error;
    } finally {
      setIsSubmittingVerifyPhone(false);
    }
  };

  const login = async (email, password) => {
    setIsSubmittingLogin(true);
    setAuthError(null);

    try {
      const result = await appClient.auth.login(email, password);

      if (result?.step === "code_required") {
        setPendingLoginEmail(result.email || email);
        setPendingLoginPhone(result.phone || null);
        setAuthError({ type: "login_code_required", message: "Código enviado." });
        return null;
      }

      setUser(result);
      setIsAuthenticated(Boolean(result));
      return result;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: "login_failed", message: error?.message || "Falha ao autenticar." });
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
      setPendingLoginPhone(null);
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
    setPendingLoginPhone(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const navigateToLogin = () => {
    appClient.auth.redirectToLogin?.(window.location.href);
    setPendingVerificationPhone(null);
    setPendingLoginEmail(null);
    setPendingLoginPhone(null);
    setAuthError({ type: "auth_required", message: "Autenticação obrigatória" });
  };

  const clearPendingVerification = () => {
    setPendingVerificationPhone(null);
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
        isSubmittingVerifyPhone,
        pendingVerificationPhone,
        pendingLoginEmail,
        pendingLoginPhone,
        login,
        register,
        logout,
        verifyPhone,
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

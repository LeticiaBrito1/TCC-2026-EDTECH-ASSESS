import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useSearchParams, useNavigate } from 'react-router-dom';
import { Suspense, useState, useEffect } from "react";
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AccessibilityProvider } from '@/lib/AccessibilityContext';
import AccessibilityWidget from '@/components/shared/AccessibilityWidget';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { appClient } from '@/api/appClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Mail, CheckCircle2, XCircle, Loader2, RefreshCw, ShieldCheck, KeyRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const RouteLoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const RouteElement = ({ Page, currentPageName }) => (
  <LayoutWrapper currentPageName={currentPageName}>
    <Suspense fallback={<RouteLoadingFallback />}>
      <Page />
    </Suspense>
  </LayoutWrapper>
);

/* ─── Hero lateral (compartilhado entre Login e Cadastro) ─── */
const AuthHero = () => (
  <section className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-2xl shadow-slate-950/20">
    <div className="mb-10 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg">
      <img src="/logoEDTECH.png" alt="EdTech Assess" className="h-14 w-14 object-contain" />
    </div>
    <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">EdTech Assess</p>
    <h1 className="max-w-lg text-4xl font-black leading-tight sm:text-5xl">
      Plataforma inteligente de avaliações educacionais.
    </h1>
    <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
      Gerencie turmas, crie avaliações com IA, corrija com OCR e acompanhe relatórios em tempo real.
    </p>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">IA com Groq/Llama</p>
        <p className="mt-2 text-sm text-slate-300">Gere questões automaticamente com IA avançada.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Correção por OCR</p>
        <p className="mt-2 text-sm text-slate-300">Digitalize gabaritos e corrija automaticamente.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Web + mobile</p>
        <p className="mt-2 text-sm text-slate-300">Mesmo backend para todos os clientes.</p>
      </div>
    </div>
  </section>
);

const authPageWrapper = (children) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,110,0.16),_transparent_38%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)]">
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <AuthHero />
        {children}
      </div>
    </div>
    <AccessibilityWidget />
  </div>
);

/* ─── Tela de Login ─── */
const LoginScreen = ({ onGoToRegister, onGoToForgot }) => {
  const { login, isSubmittingLogin, authError, pendingVerificationEmail, clearPendingVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resendStatus, setResendStatus] = useState(null); // null | "sending" | "sent"

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    try { await login(email.trim(), password); } catch { /* refletido no contexto */ }
  };

  const handleResend = async () => {
    const target = pendingVerificationEmail || email;
    if (!target) return;
    setResendStatus("sending");
    try {
      await appClient.auth.resendVerification(target);
      setResendStatus("sent");
    } catch {
      setResendStatus(null);
    }
  };

  const isUnverified = authError?.type === "email_not_verified";

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">Login</p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">Entrar no painel</h2>
        <p className="mt-3 text-sm text-slate-600">Acesse com seu e-mail e senha cadastrados.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-email">E-mail</Label>
          <Input id="login-email" type="email" autoComplete="email"
            placeholder="voce@escola.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Senha</Label>
          <Input id="login-password" type="password" autoComplete="current-password"
            placeholder="Sua senha" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>

        {authError?.type === "login_failed" && (
          <div role="alert" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {authError.message}
          </div>
        )}

        {isUnverified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">E-mail não confirmado</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Verifique sua caixa de entrada e clique no link de confirmação.
                </p>
              </div>
            </div>
            {resendStatus === "sent" ? (
              <p className="text-xs text-teal-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Novo link enviado! Verifique seu e-mail.
              </p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendStatus === "sending"}
                className="text-xs font-semibold text-amber-800 hover:underline flex items-center gap-1 disabled:opacity-50">
                {resendStatus === "sending"
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</>
                  : <><RefreshCw className="h-3 w-3" /> Reenviar e-mail de confirmação</>}
              </button>
            )}
          </div>
        )}

        <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold"
          disabled={isSubmittingLogin || !email.trim() || !password}>
          {isSubmittingLogin ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        <button type="button" onClick={onGoToForgot}
          className="font-semibold text-slate-600 hover:text-teal-700 hover:underline">
          Esqueci minha senha
        </button>
      </p>

      <p className="mt-2 text-center text-sm text-slate-500">
        Ainda não tem conta?{" "}
        <button type="button" onClick={onGoToRegister}
          className="font-semibold text-teal-700 hover:underline">
          Criar conta
        </button>
      </p>
    </section>
  );
};

/* ─── Tela de Esqueci a Senha ─── */
const ForgotPasswordScreen = ({ onGoToLogin }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending"); setErrorMsg("");
    try {
      await appClient.auth.forgotPassword(email.trim().toLowerCase());
      setStatus("sent");
    } catch (err) {
      setErrorMsg(err?.message || "Falha ao enviar. Tente novamente.");
      setStatus("idle");
    }
  };

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
        <KeyRound className="h-10 w-10 text-cyan-600" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700 mb-3">Recuperação</p>
      <h2 className="text-3xl font-black text-slate-950 mb-3">Esqueci minha senha</h2>

      {status === "sent" ? (
        <>
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle2 className="h-7 w-7 text-teal-600" />
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Se o e-mail estiver cadastrado e verificado, você receberá um link para redefinir a senha em breve. Verifique também a pasta de spam.
          </p>
          <Button className="h-12 w-full rounded-2xl text-sm font-bold" onClick={onGoToLogin}>
            Voltar para o login
          </Button>
        </>
      ) : (
        <>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
          </p>
          <form className="w-full space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input id="forgot-email" type="email" autoComplete="email"
                placeholder="voce@escola.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            {errorMsg && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMsg}
              </div>
            )}
            <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold"
              disabled={status === "sending" || !email.trim()}>
              {status === "sending"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                : "Enviar link de redefinição"}
            </Button>
          </form>
          <button type="button" onClick={onGoToLogin}
            className="mt-4 text-sm text-slate-500 hover:text-slate-800 hover:underline py-2">
            Voltar para o login
          </button>
        </>
      )}
    </section>
  );
};

/* ─── Tela de Redefinir Senha (via link do e-mail) ─── */
const ResetPasswordScreen = ({ onGoToLogin }) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (novaSenha.length < 8) { setErrorMsg("A senha deve ter no mínimo 8 caracteres."); return; }
    if (!/[A-Za-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) { setErrorMsg("A senha deve conter letras e números."); return; }
    if (novaSenha !== confirmar) { setErrorMsg("As senhas não coincidem."); return; }
    setStatus("sending");
    try {
      await appClient.auth.resetPassword(token, novaSenha);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err?.message || "Não foi possível redefinir a senha.");
      setStatus("error");
    }
  };

  if (!token) return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="text-3xl font-black text-slate-950 mb-3">Link inválido</h2>
      <p className="text-slate-600 text-sm mb-8">O link de redefinição não contém um token válido.</p>
      <Button variant="outline" className="h-12 w-full rounded-2xl text-sm font-bold" onClick={onGoToLogin}>
        Voltar para o login
      </Button>
    </section>
  );

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
        <KeyRound className="h-10 w-10 text-cyan-600" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700 mb-3">Nova senha</p>
      <h2 className="text-3xl font-black text-slate-950 mb-6">Redefinir senha</h2>

      {status === "success" ? (
        <>
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle2 className="h-7 w-7 text-teal-600" />
          </div>
          <p className="text-slate-600 text-sm mb-8">Senha redefinida com sucesso! Faça login com a nova senha.</p>
          <Button className="h-12 w-full rounded-2xl text-sm font-bold" onClick={onGoToLogin}>
            Ir para o login
          </Button>
        </>
      ) : (
        <form className="w-full space-y-4 text-left" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="rp-password">Nova senha</Label>
            <div className="relative">
              <Input id="rp-password" type={showPw ? "text" : "password"}
                autoComplete="new-password" placeholder="Mín. 8 caracteres, letras e números"
                value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
              <button type="button" tabIndex={-1}
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirmar nova senha</Label>
            <Input id="rp-confirm" type="password" autoComplete="new-password"
              placeholder="Repita a nova senha" value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMsg}
            </div>
          )}
          <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold"
            disabled={status === "sending" || !novaSenha || !confirmar}>
            {status === "sending"
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              : "Salvar nova senha"}
          </Button>
          <button type="button" onClick={onGoToLogin}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-800 hover:underline py-1">
            Cancelar
          </button>
        </form>
      )}
    </section>
  );
};

/* ─── Tela de Cadastro ─── */
const RegisterScreen = ({ onGoToLogin }) => {
  const { register, isSubmittingRegister, authError } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsTab, setTermsTab] = useState("terms");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setLocalError("Preencha todos os campos obrigatórios."); return;
    }
    if (form.full_name.trim().length < 2) {
      setLocalError("Nome deve ter ao menos 2 caracteres."); return;
    }
    if (form.password.length < 8) {
      setLocalError("A senha deve ter no mínimo 8 caracteres."); return;
    }
    if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setLocalError("A senha deve conter letras e números."); return;
    }
    if (form.password !== form.confirm_password) {
      setLocalError("As senhas não coincidem."); return;
    }
    if (!termsAccepted) {
      setLocalError("Você deve aceitar os termos de privacidade para criar uma conta."); return;
    }
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
    } catch { /* refletido no contexto */ }
  };

  const errorMessage = localError || (authError?.type === "register_failed" ? authError.message : "");

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">Cadastro</p>
        <h2 className="mt-3 text-3xl font-black text-slate-950">Criar conta</h2>
        <p className="mt-3 text-sm text-slate-600">
          Preencha os dados abaixo. Você receberá um e-mail de confirmação.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="reg-name">Nome completo *</Label>
          <Input id="reg-name" type="text" autoComplete="name" placeholder="Seu nome completo"
            value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-email">E-mail *</Label>
          <Input id="reg-email" type="email" autoComplete="email" placeholder="voce@escola.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password">Senha *</Label>
          <div className="relative">
            <Input id="reg-password" type={showPassword ? "text" : "password"}
              autoComplete="new-password" placeholder="Mín. 8 caracteres, letras e números"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" tabIndex={-1}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              onClick={() => setShowPassword(v => !v)}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-confirm">Confirmar senha *</Label>
          <Input id="reg-confirm" type="password" autoComplete="new-password"
            placeholder="Repita a senha" value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
        </div>

        {errorMessage && (
          <div role="alert" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          A conta será criada com perfil de <strong>professor</strong>. Permissões de administrador são concedidas manualmente.
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(v) => setTermsAccepted(Boolean(v))}
            className="mt-0.5 shrink-0"
          />
          <label htmlFor="terms" className="text-xs text-slate-500 cursor-pointer leading-relaxed">
            Li e aceito os{" "}
            <button type="button" onClick={() => { setTermsTab("terms"); setShowTerms(true); }} className="font-semibold text-teal-700 hover:underline">
              Termos de Uso
            </button>{" "}e a{" "}
            <button type="button" onClick={() => { setTermsTab("privacy"); setShowTerms(true); }} className="font-semibold text-teal-700 hover:underline">
              Política de Privacidade
            </button>{" "}da plataforma EdTech Assess.
          </label>
        </div>

        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{termsTab === "terms" ? "Termos de Uso" : "Política de Privacidade"}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
              <button type="button" onClick={() => setTermsTab("terms")}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${termsTab === "terms" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                Termos de Uso
              </button>
              <button type="button" onClick={() => setTermsTab("privacy")}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${termsTab === "privacy" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                Política de Privacidade
              </button>
            </div>

            {termsTab === "terms" ? (
              <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">1. Sobre a Plataforma</h3>
                  <p>O EdTech Assess é uma plataforma educacional para criação e correção de avaliações, destinada exclusivamente a professores e instituições de ensino.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">2. Uso Permitido</h3>
                  <p>A plataforma deve ser utilizada somente para fins educacionais legítimos. É proibido o uso para fins comerciais não autorizados, atividades ilegais ou que violem direitos de terceiros.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">3. Responsabilidades do Usuário</h3>
                  <p>O usuário é responsável por manter suas credenciais em sigilo, pela veracidade dos dados cadastrados e pelo conteúdo inserido na plataforma.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">4. Conteúdo Proibido</h3>
                  <p>É proibido inserir conteúdo impróprio, ofensivo, discriminatório ou ilegal. O sistema possui filtros automáticos de moderação de conteúdo.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">5. Disponibilidade</h3>
                  <p>A plataforma é oferecida sem garantia de disponibilidade contínua. Podem ocorrer interrupções para manutenção ou melhorias.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">6. Alterações nos Termos</h3>
                  <p>Estes termos podem ser atualizados a qualquer momento. O uso continuado da plataforma implica na aceitação das novas condições.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">1. Dados Coletados</h3>
                  <p>Coletamos nome completo, endereço de e-mail e dados de uso da plataforma (avaliações criadas, resultados registrados). Não coletamos dados sensíveis além dos estritamente necessários.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">2. Finalidade do Tratamento</h3>
                  <p>Os dados são utilizados exclusivamente para o funcionamento da plataforma: autenticação, geração de relatórios e comunicações sobre a conta.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">3. Compartilhamento de Dados</h3>
                  <p>Seus dados não são vendidos nem compartilhados com terceiros para fins comerciais. Podemos compartilhá-los apenas quando exigido por lei.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">4. Dados dos Alunos</h3>
                  <p>Os dados dos alunos cadastrados são de responsabilidade do professor/instituição. Recomendamos cadastrar apenas informações necessárias para a identificação nas avaliações.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">5. Segurança</h3>
                  <p>Adotamos medidas técnicas para proteger os dados armazenados, incluindo senhas criptografadas e comunicação segura com o servidor.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">6. Seus Direitos (LGPD)</h3>
                  <p>Você pode solicitar a exclusão da sua conta e de todos os dados associados a qualquer momento, em conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>
                </div>
              </div>
            )}

            <Button className="w-full mt-2" onClick={() => { setTermsAccepted(true); setShowTerms(false); }}>
              Li e aceito
            </Button>
          </DialogContent>
        </Dialog>

        <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold"
          disabled={isSubmittingRegister || !termsAccepted}>
          {isSubmittingRegister ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando conta...</> : "Criar conta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem uma conta?{" "}
        <button type="button" onClick={onGoToLogin}
          className="font-semibold text-teal-700 hover:underline">Entrar</button>
      </p>
    </section>
  );
};

/* ─── Tela de Código de Login 2FA ─── */
const LoginCodeScreen = ({ onCancel }) => {
  const { verifyLoginCode, cancelLoginCode, isSubmittingLoginCode, authError, pendingLoginEmail } = useAuth();
  const [code, setCode] = useState("");

  const handleCancel = () => {
    cancelLoginCode();
    onCancel?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    try { await verifyLoginCode(code); } catch { /* refletido no contexto */ }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-cyan-50">
        <ShieldCheck className="h-10 w-10 text-cyan-600" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700 mb-3">Verificação</p>
      <h2 className="text-3xl font-black text-slate-950 mb-3">Código de acesso</h2>
      <p className="text-slate-600 text-sm leading-relaxed mb-1">
        Enviamos um código de 6 dígitos para:
      </p>
      <p className="font-semibold text-slate-900 text-base mb-6">{pendingLoginEmail || "seu e-mail"}</p>

      <form className="w-full space-y-4" onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={handleCodeChange}
          placeholder="000000"
          className="w-full text-center text-4xl font-black tracking-[0.5em] border-2 border-slate-200 rounded-2xl py-4 px-4 focus:outline-none focus:border-cyan-500 transition-colors"
          autoFocus
        />

        {authError?.type === "login_code_failed" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {authError.message}
          </div>
        )}

        <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold"
          disabled={isSubmittingLoginCode || code.length !== 6}>
          {isSubmittingLoginCode
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
            : "Confirmar código"}
        </Button>
      </form>

      <button type="button" onClick={handleCancel}
        className="mt-4 text-sm text-slate-500 hover:text-slate-800 hover:underline py-2">
        Voltar para o login
      </button>
    </section>
  );
};

/* ─── Tela de Aguardando Verificação (após cadastro) ─── */
const VerifyEmailPendingScreen = ({ onGoToLogin }) => {
  const { pendingVerificationEmail } = useAuth();
  const [resendStatus, setResendStatus] = useState(null);

  const handleResend = async () => {
    if (!pendingVerificationEmail) return;
    setResendStatus("sending");
    try {
      await appClient.auth.resendVerification(pendingVerificationEmail);
      setResendStatus("sent");
    } catch {
      setResendStatus(null);
    }
  };

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
        <Mail className="h-10 w-10 text-teal-600" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700 mb-3">Quase lá!</p>
      <h2 className="text-3xl font-black text-slate-950 mb-3">Confirme seu e-mail</h2>
      <p className="text-slate-600 text-sm leading-relaxed mb-2">
        Enviamos um link de confirmação para:
      </p>
      <p className="font-semibold text-slate-900 text-base mb-6">
        {pendingVerificationEmail || "seu e-mail"}
      </p>
      <p className="text-slate-500 text-sm mb-8">
        Clique no link recebido para ativar sua conta e fazer login. Verifique também a pasta de spam.
      </p>

      <div className="w-full space-y-3">
        {resendStatus === "sent" ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            <CheckCircle2 className="h-4 w-4" /> Novo link enviado com sucesso!
          </div>
        ) : (
          <Button variant="outline" className="w-full h-11 rounded-2xl text-sm"
            onClick={handleResend} disabled={resendStatus === "sending"}>
            {resendStatus === "sending"
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reenviando...</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Reenviar e-mail de confirmação</>}
          </Button>
        )}

        <button type="button" onClick={onGoToLogin}
          className="w-full text-sm text-slate-500 hover:text-slate-800 hover:underline py-2">
          Voltar para o login
        </button>
      </div>
    </section>
  );
};

/* ─── Tela de Verificação de Token (rota /verify-email?token=xxx) ─── */
const VerifyEmailCallbackScreen = ({ onGoToLogin }) => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) { setStatus("error"); setMessage("Token de verificação ausente."); return; }

    appClient.auth.verifyEmail(token)
      .then((res) => { setStatus("success"); setMessage(res?.message || "E-mail confirmado!"); })
      .catch((err) => { setStatus("error"); setMessage(err?.message || "Link inválido ou expirado."); });
  }, []);

  return authPageWrapper(
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur flex flex-col items-center text-center">
      {status === "loading" && (
        <>
          <Loader2 className="h-16 w-16 text-teal-500 animate-spin mb-6" />
          <h2 className="text-2xl font-black text-slate-950 mb-2">Verificando seu e-mail...</h2>
          <p className="text-slate-500 text-sm">Aguarde um instante.</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
            <CheckCircle2 className="h-10 w-10 text-teal-600" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700 mb-3">Confirmado!</p>
          <h2 className="text-3xl font-black text-slate-950 mb-3">E-mail verificado</h2>
          <p className="text-slate-600 text-sm mb-8">{message}</p>
          <Button className="h-12 w-full rounded-2xl text-sm font-bold" onClick={onGoToLogin}>
            Ir para o login
          </Button>
        </>
      )}
      {status === "error" && (
        <>
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-950 mb-3">Link inválido</h2>
          <p className="text-slate-600 text-sm mb-8">{message}</p>
          <Button variant="outline" className="h-12 w-full rounded-2xl text-sm font-bold" onClick={onGoToLogin}>
            Voltar para o login
          </Button>
        </>
      )}
    </section>
  );
};

/* ─── App autenticado principal ─── */
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, clearPendingVerification } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const goToLogin = () => { setShowRegister(false); setShowForgot(false); clearPendingVerification(); };

  // Só exibe o app principal se o usuário estiver autenticado
  if (!isAuthenticated) {
    if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError?.type === 'verify_email_pending') return <VerifyEmailPendingScreen onGoToLogin={goToLogin} />;
    if (authError?.type === 'login_code_required' || authError?.type === 'login_code_failed') {
      return <LoginCodeScreen onCancel={goToLogin} />;
    }
    if (showForgot) return <ForgotPasswordScreen onGoToLogin={goToLogin} />;
    if (showRegister) return <RegisterScreen onGoToLogin={goToLogin} />;
    if (authError?.type === 'email_not_verified') {
      return <LoginScreen onGoToRegister={() => setShowRegister(true)} onGoToForgot={() => setShowForgot(true)} />;
    }
    return <LoginScreen onGoToRegister={() => setShowRegister(true)} onGoToForgot={() => setShowForgot(true)} />;
  }

  return (
    <Routes>
      {MainPage ? (
        <Route path="/" element={<RouteElement Page={MainPage} currentPageName={mainPageKey} />} />
      ) : (
        <Route path="/" element={<PageNotFound />} />
      )}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route key={path} path={`/${path}`}
          element={<RouteElement Page={Page} currentPageName={path} />} />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

/* ─── Wrapper que captura /verify-email antes da auth ─── */
const AppRouter = () => {
  const { clearPendingVerification } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Rota pública de verificação de e-mail */}
      <Route path="/verify-email" element={
        <VerifyEmailCallbackScreen onGoToLogin={() => {
          clearPendingVerification();
          navigate("/");
        }} />
      } />
      {/* Rota pública de redefinição de senha */}
      <Route path="/reset-password" element={
        <ResetPasswordScreen onGoToLogin={() => navigate("/")} />
      } />
      {/* Todas as demais rotas passam pelo fluxo de autenticação */}
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  );
};

function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRouter />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

export default App;

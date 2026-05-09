import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Suspense, useState } from "react";
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ScanLine } from "lucide-react";

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

const LoginScreen = () => {
  const { login, isSubmittingLogin, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;

    try {
      await login(email.trim(), password);
    } catch {
      // O erro já é refletido no contexto.
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,110,0.16),_transparent_38%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-2xl shadow-slate-950/20">
            <div className="mb-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20">
              <ScanLine className="h-7 w-7 text-cyan-300" />
            </div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">EdTech Assess</p>
            <h1 className="max-w-lg text-4xl font-black leading-tight sm:text-5xl">
              Acesso real ao sistema de avaliações.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
              Entre com um usuário persistido no backend para gerenciar turmas, avaliações, correções e relatórios.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Autenticação real</p>
                <p className="mt-2 text-sm text-slate-300">Sessão baseada em token e validação via `app_users`.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Dados persistidos</p>
                <p className="mt-2 text-sm text-slate-300">Tudo carregado do backend e do PostgreSQL.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Web + mobile</p>
                <p className="mt-2 text-sm text-slate-300">Mesmo backend de autenticação para os dois clientes.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/70 backdrop-blur">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">Login</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950">Entrar no painel web</h2>
              <p className="mt-3 text-sm text-slate-600">
                Use um email e senha válidos cadastrados no backend.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@escola.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {authError?.type === "login_failed" ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {authError.message}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl text-sm font-bold"
                disabled={isSubmittingLogin || !email.trim() || !password}
              >
                {isSubmittingLogin ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required' || authError.type === 'login_failed') {
      return <LoginScreen />;
    }
  }

  // Render the main app
  return (
    <Routes>
      {MainPage ? (
        <Route path="/" element={<RouteElement Page={MainPage} currentPageName={mainPageKey} />} />
      ) : (
        <Route path="/" element={<PageNotFound />} />
      )}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={<RouteElement Page={Page} currentPageName={path} />}
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

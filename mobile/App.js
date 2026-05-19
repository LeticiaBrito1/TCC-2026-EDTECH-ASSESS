import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, SafeAreaView,
  ScrollView, Text, TextInput, View, StyleSheet, Alert,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, apiLogin, apiVerifyLoginCode, apiMe, apiRegister, apiForgotPassword } from "./src/api/client";
import DashboardScreen from "./src/screens/DashboardScreen";
import AlunosScreen from "./src/screens/AlunosScreen";
import AvaliacoesScreen from "./src/screens/AvaliacoesScreen";
import CorrecaoScreen from "./src/screens/CorrecaoScreen";
import TurmasScreen from "./src/screens/TurmasScreen";
import DisciplinasScreen from "./src/screens/DisciplinasScreen";
import QuestoesScreen from "./src/screens/QuestoesScreen";
import RelatoriosScreen from "./src/screens/RelatoriosScreen";
import PerfilScreen from "./src/screens/PerfilScreen";
import PagamentoScreen from "./src/screens/PagamentoScreen";

const TOKEN_KEY = "edtech_mobile_token";
const Tab = createBottomTabNavigator();

const C = {
  primary: "#0f766e", bg: "#f3f4f6", white: "#fff", dark: "#0f172a",
  muted: "#64748b", border: "#e2e8f0", danger: "#b91c1c",
};

// ─── Mapa de sub-páginas do tab "Mais" ───────────────────────────────────────
const MAIS_PAGES = {
  Turmas:      { label: "Turmas",           icon: "🏫", Component: TurmasScreen },
  Disciplinas: { label: "Disciplinas",      icon: "📚", Component: DisciplinasScreen },
  Questoes:    { label: "Questões",         icon: "❓", Component: QuestoesScreen },
  Relatorios:  { label: "Relatórios",       icon: "📊", Component: RelatoriosScreen },
  Perfil:      { label: "Perfil",           icon: "👤", Component: PerfilScreen },
  Pagamento:   { label: "Plano & Pagamento",icon: "⭐", Component: PagamentoScreen },
};

// ─── Tab "Mais" com roteamento por estado ────────────────────────────────────
function MaisTab({ token, user, onLogout, onUserUpdate }) {
  const [page, setPage] = useState(null);

  if (page && MAIS_PAGES[page]) {
    const { label, Component } = MAIS_PAGES[page];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable
            onPress={() => setPage(null)}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
          >
            <Text style={{ fontSize: 20, color: C.primary }}>‹</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.primary }}>Menu</Text>
            <Text style={{ fontSize: 16, fontWeight: "400", color: C.muted, marginLeft: 4 }}>/ {label}</Text>
          </Pressable>
        </SafeAreaView>
        <Component
          token={token}
          user={user}
          onLogout={onLogout}
          onUserUpdate={onUserUpdate}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: C.dark, marginBottom: 20 }}>Menu</Text>
        <View style={{ gap: 10 }}>
          {Object.entries(MAIS_PAGES).map(([key, { label, icon }]) => (
            <Pressable
              key={key}
              onPress={() => setPage(key)}
              style={({ pressed }) => ({
                backgroundColor: C.white, borderRadius: 14, borderWidth: 1,
                borderColor: C.border, padding: 16, flexDirection: "row",
                alignItems: "center", gap: 14, opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 24 }}>{icon}</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.dark, flex: 1 }}>{label}</Text>
              <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => Alert.alert("Sair", "Deseja sair da conta?", [
            { text: "Cancelar" },
            { text: "Sair", style: "destructive", onPress: onLogout },
          ])}
          style={{ marginTop: 20, backgroundColor: "#fef2f2", borderRadius: 14, borderWidth: 1, borderColor: "#fecaca", padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <Text style={{ fontSize: 24 }}>🚪</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.danger }}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tab navigator principal ──────────────────────────────────────────────────
function MainTabs({ token, user, onLogout, onUserUpdate }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.border, paddingBottom: 4 },
        tabBarLabel:
          route.name === "Avaliacoes" ? "Avaliações" :
          route.name === "Correcao"   ? "Correção"   :
          route.name === "Mais"       ? "Menu"        :
          route.name,
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Dashboard: focused ? "home" : "home-outline",
            Avaliacoes: focused ? "document-text" : "document-text-outline",
            Correcao: focused ? "camera" : "camera-outline",
            Alunos: focused ? "people" : "people-outline",
            Mais: focused ? "grid" : "grid-outline",
          };
          return <Ionicons name={icons[route.name] || "ellipse-outline"} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard">
        {() => <DashboardScreen token={token} user={user} />}
      </Tab.Screen>
      <Tab.Screen name="Avaliacoes">
        {() => <AvaliacoesScreen token={token} />}
      </Tab.Screen>
      <Tab.Screen name="Correcao">
        {() => <CorrecaoScreen token={token} />}
      </Tab.Screen>
      <Tab.Screen name="Alunos">
        {() => <AlunosScreen token={token} />}
      </Tab.Screen>
      <Tab.Screen name="Mais">
        {() => <MaisTab token={token} user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ─── Tela de Login ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, loading, error, onGoRegister, onGoForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 28,
            backgroundColor: C.white,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
          }}>
            <Image source={require("./assets/logoEDTECH.png")} style={{ width: 80, height: 80 }} resizeMode="contain" />
          </View>
          <Text style={{ fontSize: 26, fontWeight: "900", color: C.dark }}>EdTech Assess</Text>
          <Text style={{ fontSize: 13, color: C.muted }}>Plataforma de avaliações com IA</Text>
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 20, gap: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: C.dark }}>Entrar na conta</Text>
          <View style={{ gap: 4 }}>
            <Text style={authStyles.label}>Email</Text>
            <TextInput style={authStyles.input} placeholder="seu@email.com" autoCapitalize="none"
              keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={C.muted} />
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={authStyles.label}>Senha</Text>
              <Pressable onPress={onGoForgot}>
                <Text style={{ fontSize: 13, color: C.primary, fontWeight: "600" }}>Esqueci a senha</Text>
              </Pressable>
            </View>
            <TextInput style={authStyles.input} placeholder="••••••••" secureTextEntry
              autoCapitalize="none" value={password} onChangeText={setPassword} placeholderTextColor={C.muted} />
          </View>
          {error ? <Text style={{ color: C.danger, fontWeight: "700", fontSize: 13 }}>{error}</Text> : null}
          <Pressable onPress={() => onLogin(email.trim(), password)} disabled={loading || !email.trim() || !password}
            style={({ pressed }) => [authStyles.btn, (pressed || loading) && { opacity: 0.7 }]}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={authStyles.btnText}>Entrar</Text>}
          </Pressable>
        </View>

        <Pressable onPress={onGoRegister} style={{ alignItems: "center", padding: 8 }}>
          <Text style={{ fontSize: 14, color: C.muted }}>
            Não tem conta?{" "}
            <Text style={{ color: C.primary, fontWeight: "700" }}>Criar conta grátis</Text>
          </Text>
        </Pressable>

        <Text style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>API: {API_BASE_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tela de Cadastro ─────────────────────────────────────────────────────────
function RegisterScreen({ onBack, onRegistered }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError("");
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError("Preencha todos os campos obrigatórios."); return;
    }
    if (form.password !== form.confirm) {
      setError("As senhas não coincidem."); return;
    }
    if (form.password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres."); return;
    }
    if (!terms) {
      setError("Você deve aceitar os termos de privacidade."); return;
    }
    setLoading(true);
    try {
      await apiRegister({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      setSuccess(true);
    } catch (e) { setError(e?.message || "Falha ao criar conta."); }
    finally { setLoading(false); }
  };

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
          <View style={{ alignItems: "center", gap: 16 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 40 }}>✅</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "900", color: C.dark, textAlign: "center" }}>Conta criada!</Text>
            <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 22 }}>
              Verifique seu email para ativar a conta e depois faça o login.
            </Text>
            <Pressable onPress={onBack} style={[authStyles.btn, { width: "100%" }]}>
              <Text style={authStyles.btnText}>Ir para o Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 }}>
          <Pressable onPress={onBack} style={{ padding: 4 }}>
            <Text style={{ fontSize: 24, color: C.primary }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: C.dark }}>Criar conta</Text>
        </View>

        <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 20, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={authStyles.label}>Nome completo *</Text>
            <TextInput style={authStyles.input} placeholder="Seu nome" value={form.full_name}
              onChangeText={v => setForm({ ...form, full_name: v })} placeholderTextColor={C.muted} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={authStyles.label}>Email *</Text>
            <TextInput style={authStyles.input} placeholder="seu@email.com" autoCapitalize="none"
              keyboardType="email-address" value={form.email}
              onChangeText={v => setForm({ ...form, email: v })} placeholderTextColor={C.muted} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={authStyles.label}>Senha * (mín. 6 caracteres)</Text>
            <TextInput style={authStyles.input} placeholder="••••••••" secureTextEntry
              autoCapitalize="none" value={form.password}
              onChangeText={v => setForm({ ...form, password: v })} placeholderTextColor={C.muted} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={authStyles.label}>Confirmar senha *</Text>
            <TextInput style={authStyles.input} placeholder="••••••••" secureTextEntry
              autoCapitalize="none" value={form.confirm}
              onChangeText={v => setForm({ ...form, confirm: v })} placeholderTextColor={C.muted} />
          </View>

          <Pressable onPress={() => setTerms(t => !t)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: terms ? C.primary : C.border,
              backgroundColor: terms ? C.primary : C.white,
              alignItems: "center", justifyContent: "center" }}>
              {terms ? <Text style={{ color: C.white, fontSize: 13, fontWeight: "900" }}>✓</Text> : null}
            </View>
            <Text style={{ fontSize: 13, color: C.muted, flex: 1, lineHeight: 18 }}>
              Aceito os{" "}
              <Text style={{ color: C.primary, fontWeight: "700" }}>termos de privacidade</Text>
              {" "}e uso da plataforma EdTech Assess
            </Text>
          </Pressable>

          {error ? <Text style={{ color: C.danger, fontWeight: "700", fontSize: 13 }}>{error}</Text> : null}

          <Pressable onPress={submit} disabled={loading}
            style={({ pressed }) => [authStyles.btn, (pressed || loading) && { opacity: 0.7 }]}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={authStyles.btnText}>Criar conta</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tela Esqueci a Senha ─────────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) { setError("Digite seu email."); return; }
    setError(""); setLoading(true);
    try {
      await apiForgotPassword(email.trim());
      setSent(true);
    } catch (e) { setError(e?.message || "Falha ao enviar email."); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={onBack} style={{ padding: 4 }}>
            <Text style={{ fontSize: 24, color: C.primary }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: C.dark }}>Esqueci a senha</Text>
        </View>

        {sent ? (
          <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 24, gap: 16, alignItems: "center" }}>
            <Text style={{ fontSize: 40 }}>📧</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: C.dark, textAlign: "center" }}>Email enviado!</Text>
            <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 22 }}>
              Verifique sua caixa de entrada e siga as instruções para redefinir a senha.
            </Text>
            <Pressable onPress={onBack} style={[authStyles.btn, { width: "100%" }]}>
              <Text style={authStyles.btnText}>Voltar ao Login</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 20, gap: 14 }}>
            <Text style={{ fontSize: 14, color: C.muted, lineHeight: 20 }}>
              Digite seu email cadastrado e enviaremos um link para redefinir sua senha.
            </Text>
            <View style={{ gap: 4 }}>
              <Text style={authStyles.label}>Email</Text>
              <TextInput style={authStyles.input} placeholder="seu@email.com" autoCapitalize="none"
                keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={C.muted} />
            </View>
            {error ? <Text style={{ color: C.danger, fontWeight: "700", fontSize: 13 }}>{error}</Text> : null}
            <Pressable onPress={submit} disabled={loading}
              style={({ pressed }) => [authStyles.btn, (pressed || loading) && { opacity: 0.7 }]}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={authStyles.btnText}>Enviar link</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoginCodeScreen({ email, onVerify, onCancel, loading, error }) {
  const [code, setCode] = useState("");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.primary, textTransform: "uppercase" }}>Verificação 2FA</Text>
          <Text style={{ fontSize: 24, fontWeight: "900", color: C.dark }}>Código de acesso</Text>
          <Text style={{ color: C.muted }}>Enviamos um código para {email}</Text>
        </View>
        <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 20, gap: 14 }}>
          <TextInput style={[authStyles.input, { textAlign: "center", fontSize: 28, fontWeight: "900", letterSpacing: 8 }]}
            placeholder="000000" keyboardType="number-pad" maxLength={6} value={code}
            onChangeText={v => setCode(v.replace(/\D/g, "").slice(0, 6))} placeholderTextColor={C.muted} />
          {error ? <Text style={{ color: C.danger, fontWeight: "700", fontSize: 13 }}>{error}</Text> : null}
          <Pressable onPress={() => onVerify(code)} disabled={loading || code.length !== 6}
            style={({ pressed }) => [authStyles.btn, (pressed || loading || code.length !== 6) && { opacity: 0.6 }]}>
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={{ color: C.white, fontWeight: "800", fontSize: 15 }}>Confirmar código</Text>}
          </Pressable>
          <Pressable onPress={onCancel}>
            <Text style={{ textAlign: "center", color: C.muted, fontWeight: "600" }}>Voltar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const authStyles = StyleSheet.create({
  input: { backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.dark },
  btn: { backgroundColor: C.primary, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "700", color: "#334155" },
});

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [authScreen, setAuthScreen] = useState("login"); // "login" | "register" | "forgot"

  useEffect(() => {
    (async () => {
      try {
        const stored = (await SecureStore.getItemAsync(TOKEN_KEY)) || "";
        if (stored) { const me = await apiMe(stored); setToken(stored); setUser(me); }
      } catch { await SecureStore.deleteItemAsync(TOKEN_KEY); }
      finally { setBooting(false); }
    })();
  }, []);

  const handleLogin = useCallback(async (email, password) => {
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await apiLogin({ email, password });
      if (res?.step === "code_required") { setPendingEmail(res.email || email); return; }
      if (res?.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, res.token);
        setToken(res.token);
        setUser(res.user || await apiMe(res.token));
      }
    } catch (e) { setAuthError(e?.message || "Falha no login."); }
    finally { setAuthLoading(false); }
  }, []);

  const handleVerifyCode = useCallback(async (code) => {
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await apiVerifyLoginCode({ email: pendingEmail, code });
      if (!res?.token) throw new Error("Token ausente.");
      await SecureStore.setItemAsync(TOKEN_KEY, res.token);
      setToken(res.token); setUser(res.user || await apiMe(res.token)); setPendingEmail("");
    } catch (e) { setAuthError(e?.message || "Código inválido."); }
    finally { setAuthLoading(false); }
  }, [pendingEmail]);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(""); setUser(null); setAuthError(""); setPendingEmail("");
  }, []);

  const handleUserUpdate = useCallback((updated) => setUser(u => ({ ...u, ...updated })), []);

  if (booting) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: C.white, alignItems: "center", justifyContent: "center", marginBottom: 20, elevation: 4 }}>
        <Image source={require("./assets/logoEDTECH.png")} style={{ width: 68, height: 68 }} resizeMode="contain" />
      </View>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    if (pendingEmail) {
      return <LoginCodeScreen email={pendingEmail} onVerify={handleVerifyCode}
        onCancel={() => { setPendingEmail(""); setAuthError(""); }} loading={authLoading} error={authError} />;
    }
    if (authScreen === "register") {
      return <RegisterScreen onBack={() => { setAuthScreen("login"); setAuthError(""); }}
        onRegistered={() => setAuthScreen("login")} />;
    }
    if (authScreen === "forgot") {
      return <ForgotPasswordScreen onBack={() => { setAuthScreen("login"); setAuthError(""); }} />;
    }
    return <LoginScreen onLogin={handleLogin} loading={authLoading} error={authError}
      onGoRegister={() => { setAuthError(""); setAuthScreen("register"); }}
      onGoForgot={() => { setAuthError(""); setAuthScreen("forgot"); }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainTabs token={token} user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

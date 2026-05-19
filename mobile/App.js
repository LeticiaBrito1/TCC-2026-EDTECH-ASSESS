import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  API_BASE_URL,
  apiCorrectByOcr,
  apiCreateEntity,
  apiListEntities,
  apiLogin,
  apiVerifyLoginCode,
  apiMe,
} from "./src/api/client";
import { parseQrPayload } from "./src/utils/qrParser";

const TOKEN_STORAGE_KEY = "edtech_mobile_token";
const LETRAS = ["A", "B", "C", "D", "E"];
const STATUS_LABELS = { rascunho: "Rascunho", publicada: "Publicada", aplicada: "Aplicada", corrigida: "Corrigida" };

const shortId = (v) => { const s = String(v || "").trim(); return s.length <= 18 ? s : `${s.slice(0, 8)}...${s.slice(-6)}`; };
const isAuthError = (m) => /token|sessao|sessão|401/i.test(String(m || ""));
const buildImagePayload = (asset) => {
  const b64 = String(asset?.base64 || "").trim();
  if (!b64) throw new Error("A imagem precisa estar em base64.");
  if (b64.startsWith("data:")) return b64;
  return `data:${asset?.mimeType || "image/jpeg"};base64,${b64}`;
};

// ---------------------------------------------------------------------------
// Componentes — memoizados para evitar re-renders desnecessários
// ---------------------------------------------------------------------------

const ActionButton = React.memo(({ title, onPress, variant = "primary", disabled = false }) => {
  const bs = variant === "ghost" ? styles.buttonGhost
    : variant === "danger" ? styles.buttonDanger
    : variant === "secondary" ? styles.buttonSecondary
    : styles.buttonPrimary;
  const ts = (variant === "ghost" || variant === "secondary") ? styles.buttonTextDark : styles.buttonTextLight;
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.buttonBase, bs, (pressed || disabled) && styles.buttonPressed]}>
      <Text style={[styles.buttonText, ts]}>{title}</Text>
    </Pressable>
  );
});

const SelectionField = React.memo(({ label, value, placeholder, helperText, onPress, disabled = false }) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.label}>{label}</Text>
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.selectionField, disabled && styles.selectionFieldDisabled, pressed && !disabled && styles.selectionFieldPressed]}>
      <View style={styles.selectionFieldTextBlock}>
        <Text style={value ? styles.selectionFieldValue : styles.selectionFieldPlaceholder}>{value || placeholder}</Text>
        <Text style={styles.selectionFieldAction}>{disabled ? "Indisponível" : "Selecionar"}</Text>
      </View>
    </Pressable>
    {helperText ? <Text style={styles.hintText}>{helperText}</Text> : null}
  </View>
));

// FlatList-based modal — renderiza apenas os itens visíveis (virtualizado)
const SelectionModal = React.memo(({ visible, title, items, emptyMessage, selectedId, getTitle, getSubtitle, onSelect, onClose }) => {
  const renderItem = useCallback(({ item }) => {
    const isSel = item.id === selectedId;
    return (
      <Pressable onPress={() => onSelect(item)}
        style={({ pressed }) => [styles.modalItem, isSel && styles.modalItemSelected, pressed && styles.selectionFieldPressed]}>
        <Text style={styles.modalItemTitle}>{getTitle(item)}</Text>
        {getSubtitle(item) ? <Text style={styles.modalItemSubtitle}>{getSubtitle(item)}</Text> : null}
      </Pressable>
    );
  }, [selectedId, getTitle, getSubtitle, onSelect]);

  const keyExtractor = useCallback((item) => item.id, []);
  const empty = useMemo(() => (
    <View style={styles.emptyCard}>
      <Text style={styles.sectionTitle}>Nada para selecionar</Text>
      <Text style={styles.subtitle}>{emptyMessage}</Text>
    </View>
  ), [emptyMessage]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Toque para selecionar.</Text>
          </View>
          <ActionButton title="Fechar" variant="ghost" onPress={onClose} />
        </View>
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.modalList}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
        />
      </SafeAreaView>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Tela de login / código 2FA — componentes leves, raramente re-renderizados
// ---------------------------------------------------------------------------

const LoginScreen = React.memo(({ onLogin, loading, errorMessage }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.loginScrollContent}>
        <View style={styles.loginHero}>
          <Text style={styles.eyebrow}>EdTech Assess</Text>
          <Text style={styles.loginTitle}>Entrar no app mobile</Text>
        </View>
        <View style={styles.loginContainer}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="Digite seu email" autoCapitalize="none"
              keyboardType="email-address" autoCorrect={false} value={email} onChangeText={setEmail} />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Senha</Text>
            <TextInput style={styles.input} secureTextEntry placeholder="Digite sua senha"
              autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} />
          </View>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <ActionButton title={loading ? "Entrando..." : "Entrar"}
            disabled={loading || !email.trim() || !password} onPress={() => onLogin(email.trim(), password)} />
          <Text style={styles.hintText}>API: {API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

const LoginCodeScreen = React.memo(({ email, onVerify, onCancel, loading, errorMessage }) => {
  const [code, setCode] = useState("");
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.loginScrollContent}>
        <View style={styles.loginHero}>
          <Text style={styles.eyebrow}>Verificação 2FA</Text>
          <Text style={styles.loginTitle}>Código de acesso</Text>
          <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para {email}.</Text>
        </View>
        <View style={styles.loginContainer}>
          <TextInput style={[styles.input, styles.codeInput]} placeholder="000000" keyboardType="number-pad"
            maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <ActionButton title={loading ? "Verificando..." : "Confirmar código"}
            disabled={loading || code.length !== 6} onPress={() => onVerify(code)} />
          <ActionButton title="Voltar" variant="ghost" disabled={loading} onPress={onCancel} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

// ---------------------------------------------------------------------------
// App principal
// ---------------------------------------------------------------------------

export default function App() {
  // Auth
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // Dados operacionais (leve — apenas avaliações e alunos no startup)
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Questões — carregadas sob demanda (modo manual)
  const [questoes, setQuestoes] = useState([]);
  const [questoesLoading, setQuestoesLoading] = useState(false);
  const questoesLoadedRef = useRef(false); // evita chamadas duplicadas

  // Seleção / fluxo
  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [versao, setVersao] = useState("");
  const [correctionMode, setCorrectionMode] = useState("ocr"); // "ocr" | "manual"
  const [manualRespostas, setManualRespostas] = useState({});

  // OCR
  const [imageAsset, setImageAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState(null);

  // UI
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [pickerMode, setPickerMode] = useState(""); // "avaliacao" | "aluno" | ""
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ---------------------------------------------------------------------------
  // Memos derivados
  // ---------------------------------------------------------------------------

  const selectedAvaliacao = useMemo(
    () => avaliacoes.find((a) => a.id === avaliacaoId) || null,
    [avaliacoes, avaliacaoId]
  );

  const availableAlunos = useMemo(() => {
    if (!selectedAvaliacao?.turma_id) return alunos;
    return alunos.filter((a) => a.turma_id === selectedAvaliacao.turma_id);
  }, [alunos, selectedAvaliacao]);

  const selectedAluno = useMemo(
    () => availableAlunos.find((a) => a.id === alunoId) || alunos.find((a) => a.id === alunoId) || null,
    [availableAlunos, alunos, alunoId]
  );

  const questoesAvaliacao = useMemo(() => {
    if (!selectedAvaliacao?.questoes_ids?.length) return [];
    return selectedAvaliacao.questoes_ids.map((id) => questoes.find((q) => q.id === id)).filter(Boolean);
  }, [selectedAvaliacao, questoes]);

  // ---------------------------------------------------------------------------
  // Carregamento de dados
  // ---------------------------------------------------------------------------

  // Dados leves — carregados no login (sem questões)
  const loadOperationalData = useCallback(async (authToken) => {
    setDataLoading(true);
    setDataError("");
    try {
      const [avData, alData] = await Promise.all([
        apiListEntities(authToken, "avaliacoes"),
        apiListEntities(authToken, "alunos"),
      ]);
      setAvaliacoes(
        [...(Array.isArray(avData) ? avData : [])].sort((a, b) =>
          String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
        )
      );
      setAlunos(
        [...(Array.isArray(alData) ? alData : [])].sort((a, b) =>
          String(a.nome || "").localeCompare(String(b.nome || ""))
        )
      );
    } catch (err) {
      const msg = err?.message || "Falha ao carregar dados.";
      setDataError(msg);
      if (isAuthError(msg)) { await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY); setToken(""); setUser(null); }
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Questões — carregadas sob demanda (apenas uma vez por sessão)
  const loadQuestoes = useCallback(async (authToken) => {
    if (questoesLoadedRef.current || questoesLoading) return;
    setQuestoesLoading(true);
    try {
      const data = await apiListEntities(authToken, "questoes");
      setQuestoes(Array.isArray(data) ? data : []);
      questoesLoadedRef.current = true;
    } catch {
      // Silencia — o usuário verá "sem questões" e poderá tentar atualizar
    } finally {
      setQuestoesLoading(false);
    }
  }, [questoesLoading]);

  // ---------------------------------------------------------------------------
  // Efeitos
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const stored = (await SecureStore.getItemAsync(TOKEN_STORAGE_KEY)) || "";
        if (!stored) return;
        const me = await apiMe(stored);
        setToken(stored);
        setUser(me);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setAvaliacoes([]); setAlunos([]); setQuestoes([]);
      questoesLoadedRef.current = false;
      return;
    }
    loadOperationalData(token);
  }, [token, user]);

  // Carrega questões quando usuário entra em modo manual
  useEffect(() => {
    if (correctionMode === "manual" && token && !questoesLoadedRef.current) {
      loadQuestoes(token);
    }
  }, [correctionMode, token]);

  // Limpa aluno se mudou de avaliação e turmas incompatíveis
  useEffect(() => {
    if (!selectedAvaliacao?.turma_id || !selectedAluno?.turma_id) return;
    if (selectedAvaliacao.turma_id !== selectedAluno.turma_id) setAlunoId("");
  }, [selectedAvaliacao?.id]);

  // Limpa respostas manuais quando muda a avaliação
  useEffect(() => { setManualRespostas({}); }, [avaliacaoId]);

  // ---------------------------------------------------------------------------
  // Handlers — useCallback para não propagar re-renders
  // ---------------------------------------------------------------------------

  const handleLogin = useCallback(async (email, password) => {
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await apiLogin({ email, password });
      if (res?.step === "code_required") { setPendingEmail(res.email || email); return; }
      if (res?.token) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.token);
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
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.token);
      setToken(res.token);
      setUser(res.user || await apiMe(res.token));
      setPendingEmail("");
    } catch (e) { setAuthError(e?.message || "Código inválido."); }
    finally { setAuthLoading(false); }
  }, [pendingEmail]);

  const handleCancelCode = useCallback(() => { setPendingEmail(""); setAuthError(""); }, []);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setToken(""); setUser(null); setAuthError(""); setDataError("");
    setRequestError(""); setResult(null); setImageAsset(null);
    setAvaliacaoId(""); setAlunoId(""); setVersao(""); setPickerMode("");
    setManualRespostas({}); questoesLoadedRef.current = false;
  }, []);

  const chooseFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão necessária", "Autorize a galeria."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.6, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setImageAsset(res.assets[0]); setResult(null); setRequestError("");
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão necessária", "Autorize a câmera."); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.6, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setImageAsset(res.assets[0]); setResult(null); setRequestError("");
  }, []);

  const handleSubmitOcr = useCallback(async () => {
    if (!imageAsset) { setRequestError("Selecione ou tire uma foto do cartão resposta."); return; }
    setRequestError(""); setSubmitting(true);
    try {
      const payload = { image_base64: buildImagePayload(imageAsset) };
      if (avaliacaoId) payload.avaliacao_id = avaliacaoId;
      if (alunoId) payload.aluno_id = alunoId;
      setResult(await apiCorrectByOcr(token, payload));
    } catch (e) {
      const msg = e?.message || "Falha ao corrigir.";
      setRequestError(msg);
      if (isAuthError(msg)) await handleLogout();
    } finally { setSubmitting(false); }
  }, [imageAsset, avaliacaoId, alunoId, token, handleLogout]);

  const handleSubmitManual = useCallback(async () => {
    if (!avaliacaoId || !alunoId) { setRequestError("Selecione a avaliação e o aluno."); return; }
    if (questoesAvaliacao.length === 0) { setRequestError("A avaliação não possui questões."); return; }
    setRequestError(""); setSubmittingManual(true);
    try {
      const respostasArray = questoesAvaliacao.map((q) => {
        const resposta = manualRespostas[q.id] || "";
        const gabarito = String(q.gabarito || "").toUpperCase();
        return { questao_id: q.id, resposta, correta: Boolean(resposta) && resposta === gabarito };
      });
      const totalAcertos = respostasArray.filter((r) => r.correta).length;
      const total = respostasArray.length;
      const nota = total > 0
        ? Math.round(((totalAcertos / total) * (Number(selectedAvaliacao?.total_pontos) || 10)) * 100) / 100
        : 0;
      const created = await apiCreateEntity(token, "resultados", {
        avaliacao_id: avaliacaoId, aluno_id: alunoId,
        turma_id: selectedAvaliacao?.turma_id || null,
        respostas: respostasArray, nota,
        total_acertos: totalAcertos, total_questoes: total,
        percentual_acerto: total > 0 ? Math.round((totalAcertos / total) * 100) : 0,
        status: "corrigido",
      });
      setResult({ resultado: created, respostas_map: null, detected: null });
    } catch (e) {
      const msg = e?.message || "Falha ao salvar.";
      setRequestError(msg);
      if (isAuthError(msg)) await handleLogout();
    } finally { setSubmittingManual(false); }
  }, [avaliacaoId, alunoId, questoesAvaliacao, manualRespostas, selectedAvaliacao, token, handleLogout]);

  const onBarcodeScanned = useCallback(({ data }) => {
    if (scanned) return;
    setScanned(true);
    const parsed = parseQrPayload(data);
    if (!parsed) { Alert.alert("QR inválido", "Não foi possível extrair os dados."); setScanned(false); return; }
    setAvaliacaoId(parsed.avaliacaoId);
    setAlunoId(parsed.alunoId);
    setVersao(parsed.versao || "");
    setScannerVisible(false);
    setScanned(false);
  }, [scanned]);

  const resetCorrecao = useCallback(() => {
    setResult(null); setImageAsset(null); setRequestError(""); setManualRespostas({});
  }, []);

  // Handlers para SelectionModal (estáveis entre renders)
  const onSelectAvaliacao = useCallback((item) => {
    setAvaliacaoId(item.id);
    if (item.turma_id && selectedAluno?.turma_id && selectedAluno.turma_id !== item.turma_id) setAlunoId("");
    setPickerMode("");
  }, [selectedAluno]);

  const onSelectAluno = useCallback((item) => { setAlunoId(item.id); setPickerMode(""); }, []);
  const onCloseModal = useCallback(() => setPickerMode(""), []);
  const onCloseScannerModal = useCallback(() => setScannerVisible(false), []);

  const getAvaliacaoTitle = useCallback((item) => item.titulo || `Avaliação ${shortId(item.id)}`, []);
  const getAvaliacaoSubtitle = useCallback((item) =>
    [STATUS_LABELS[item.status] || item.status, item.data_aplicacao || shortId(item.id)].filter(Boolean).join(" • "), []);
  const getAlunoTitle = useCallback((item) => item.nome || `Aluno ${shortId(item.id)}`, []);
  const getAlunoSubtitle = useCallback((item) => [item.matricula, item.email].filter(Boolean).join(" • "), []);

  const setLetra = useCallback((questaoId, letra) =>
    setManualRespostas((prev) => ({ ...prev, [questaoId]: letra })), []);
  const clearLetra = useCallback((questaoId) =>
    setManualRespostas((prev) => { const n = { ...prev }; delete n[questaoId]; return n; }), []);

  // ---------------------------------------------------------------------------
  // Boot / auth gates
  // ---------------------------------------------------------------------------

  if (booting) return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Carregando sessão...</Text>
      </View>
    </SafeAreaView>
  );

  if (!token || !user) {
    if (pendingEmail) return <LoginCodeScreen email={pendingEmail} onVerify={handleVerifyCode} onCancel={handleCancelCode} loading={authLoading} errorMessage={authError} />;
    return <LoginScreen onLogin={handleLogin} loading={authLoading} errorMessage={authError} />;
  }

  const correction = result?.resultado || null;

  // ---------------------------------------------------------------------------
  // Tela de resultado
  // ---------------------------------------------------------------------------

  if (correction) return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Correção Concluída ✓</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.detectedCard}>
            <Text style={styles.detectedLabel}>{result?.detected ? "Identificado pela IA" : "Corrigido manualmente"}</Text>
            <Text style={styles.detectedValue}>{result?.detected?.aluno_nome || selectedAluno?.nome || "Aluno"}</Text>
            <Text style={styles.detectedSub}>
              {result?.detected?.avaliacao_titulo || selectedAvaliacao?.titulo || "Avaliação"}
              {(result?.detected?.versao || versao) ? ` — Versão ${result?.detected?.versao || versao}` : ""}
            </Text>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultCell}><Text style={styles.resultBigNumber}>{correction.nota}</Text><Text style={styles.resultCellLabel}>Nota</Text></View>
            <View style={styles.resultCell}><Text style={styles.resultBigNumber}>{correction.total_acertos}/{correction.total_questoes}</Text><Text style={styles.resultCellLabel}>Acertos</Text></View>
            <View style={styles.resultCell}><Text style={styles.resultBigNumber}>{correction.percentual_acerto}%</Text><Text style={styles.resultCellLabel}>Aproveitamento</Text></View>
          </View>

          {correction.respostas?.map((r, idx) => (
            <View key={idx} style={[styles.respostaRow, r.correta ? styles.respostaCerta : styles.respostaErrada]}>
              <Text style={styles.respostaLabel}>Q{idx + 1}</Text>
              <Text style={styles.respostaLetra}>{r.resposta || "—"}</Text>
              <Text style={r.correta ? styles.respostaCertaText : styles.respostaErradaText}>{r.correta ? "✓" : "✗"}</Text>
            </View>
          ))}
        </View>
        <ActionButton title="Corrigir Outra Prova" onPress={resetCorrecao} />
        <Text style={styles.hintText}>Backend: {API_BASE_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );

  // ---------------------------------------------------------------------------
  // Tela principal
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.eyebrow}>EdTech Assess</Text>
            <Text style={styles.headerTitle}>Correção Mobile</Text>
            <Text style={[styles.subtitle, { color: "#94a3b8" }]}>{user?.full_name || user?.email}</Text>
          </View>
          <View style={styles.headerActions}>
            <ActionButton title={dataLoading ? "..." : "↻"} variant="ghost" disabled={dataLoading} onPress={() => loadOperationalData(token)} />
            <ActionButton title="Sair" variant="danger" onPress={handleLogout} />
          </View>
        </View>

        {/* Identificação */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identificação</Text>
          <SelectionField
            label="Avaliação"
            value={selectedAvaliacao?.titulo || (avaliacaoId ? shortId(avaliacaoId) : "")}
            placeholder={dataLoading ? "Carregando..." : "Selecione ou escaneie o QR"}
            helperText={selectedAvaliacao ? `${STATUS_LABELS[selectedAvaliacao.status] || selectedAvaliacao.status || ""}` : dataError || undefined}
            onPress={() => setPickerMode("avaliacao")}
            disabled={dataLoading}
          />
          <SelectionField
            label="Aluno"
            value={selectedAluno?.nome || (alunoId ? shortId(alunoId) : "")}
            placeholder="Selecione ou escaneie o QR"
            helperText={selectedAluno?.matricula ? `Matrícula: ${selectedAluno.matricula}` : undefined}
            onPress={() => setPickerMode("aluno")}
            disabled={dataLoading}
          />
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Versão da prova</Text>
            <TextInput style={styles.input} value={versao} onChangeText={setVersao}
              placeholder="Ex: A, B, C" autoCapitalize="characters" />
          </View>
          <ActionButton title="📷  Ler QR Code da prova" onPress={() => { setScannerVisible(true); setScanned(false); }} />
        </View>

        {/* Modo de correção */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Método de Correção</Text>
          <View style={styles.modeToggle}>
            <Pressable style={[styles.modeTab, correctionMode === "ocr" && styles.modeTabActive]} onPress={() => setCorrectionMode("ocr")}>
              <Text style={[styles.modeTabText, correctionMode === "ocr" && styles.modeTabTextActive]}>📸 Foto (OCR)</Text>
            </Pressable>
            <Pressable style={[styles.modeTab, correctionMode === "manual" && styles.modeTabActive]} onPress={() => setCorrectionMode("manual")}>
              <Text style={[styles.modeTabText, correctionMode === "manual" && styles.modeTabTextActive]}>✏️ Manual</Text>
            </Pressable>
          </View>
        </View>

        {/* OCR */}
        {correctionMode === "ocr" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cartão Resposta — Foto</Text>
            <Text style={styles.hintText}>
              Fotografe o cartão resposta. Se avaliação e aluno já estiverem selecionados, a IA foca só nas marcações.
            </Text>
            <View style={styles.rowButtons}>
              <View style={styles.rowButtonItem}><ActionButton title="📷 Tirar foto" onPress={takePhoto} /></View>
              <View style={styles.rowButtonItem}><ActionButton title="🖼 Galeria" variant="ghost" onPress={chooseFromLibrary} /></View>
            </View>
            {imageAsset?.uri
              ? <Image source={{ uri: imageAsset.uri }} style={styles.previewImage} />
              : <Text style={styles.hintText}>Nenhuma imagem selecionada.</Text>}
            <ActionButton
              title={submitting ? "Analisando... (pode demorar)" : "Corrigir por OCR"}
              onPress={handleSubmitOcr}
              disabled={submitting || !imageAsset}
            />
            {submitting && <ActivityIndicator style={{ marginTop: 4 }} />}
            {requestError ? <Text style={styles.errorText}>{requestError}</Text> : null}
          </View>
        )}

        {/* Manual */}
        {correctionMode === "manual" && (
          <ManualSection
            avaliacaoId={avaliacaoId}
            alunoId={alunoId}
            questoesAvaliacao={questoesAvaliacao}
            questoesLoading={questoesLoading}
            manualRespostas={manualRespostas}
            setLetra={setLetra}
            clearLetra={clearLetra}
            submittingManual={submittingManual}
            requestError={requestError}
            onSubmit={handleSubmitManual}
          />
        )}

        {dataError ? <Text style={styles.errorText}>{dataError}</Text> : null}
        <Text style={styles.hintText}>Backend: {API_BASE_URL}</Text>
      </ScrollView>

      {/* Modais de seleção */}
      <SelectionModal visible={pickerMode === "avaliacao"} title="Selecionar avaliação"
        items={avaliacoes} selectedId={avaliacaoId} emptyMessage="Cadastre uma avaliação no sistema web."
        getTitle={getAvaliacaoTitle} getSubtitle={getAvaliacaoSubtitle}
        onSelect={onSelectAvaliacao} onClose={onCloseModal} />

      <SelectionModal visible={pickerMode === "aluno"} title="Selecionar aluno"
        items={availableAlunos} selectedId={alunoId} emptyMessage="Nenhum aluno disponível."
        getTitle={getAlunoTitle} getSubtitle={getAlunoSubtitle}
        onSelect={onSelectAluno} onClose={onCloseModal} />

      {/* QR Scanner */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={onCloseScannerModal}>
        <SafeAreaView style={styles.scannerScreen}>
          <Text style={styles.title}>Scanner de QR</Text>
          <Text style={styles.subtitle}>Aponte para o QR da prova.</Text>
          <View style={styles.cameraWrapper}>
            {cameraPermission?.granted
              ? <CameraView style={styles.camera} facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={onBarcodeScanned} />
              : <View style={styles.permissionCard}>
                  <Text style={styles.subtitle}>Permita acesso à câmera.</Text>
                  <ActionButton title="Permitir câmera" onPress={requestCameraPermission} />
                </View>}
          </View>
          <View style={styles.rowButtons}>
            <View style={styles.rowButtonItem}><ActionButton title="Ler novamente" variant="ghost" onPress={() => setScanned(false)} /></View>
            <View style={styles.rowButtonItem}><ActionButton title="Fechar" variant="danger" onPress={onCloseScannerModal} /></View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Seção manual — componente separado para isolar re-renders do scroll de questões
// ---------------------------------------------------------------------------

const QuestaoItem = React.memo(({ questao, idx, resposta, onSetLetra, onClearLetra }) => {
  const letrasDisponiveis = useMemo(
    () => questao.alternativas?.map((a) => a.letra).filter((l) => LETRAS.includes(l)) || LETRAS,
    [questao.alternativas]
  );
  return (
    <View style={styles.questaoBlock}>
      <View style={styles.questaoHeader}>
        <Text style={styles.questaoNumero}>Q{idx + 1}</Text>
        {resposta
          ? <Pressable onPress={() => onClearLetra(questao.id)}><Text style={styles.limparText}>Limpar</Text></Pressable>
          : null}
      </View>
      {questao.enunciado ? <Text style={styles.questaoEnunciado} numberOfLines={2}>{questao.enunciado}</Text> : null}
      <View style={styles.letrasRow}>
        {letrasDisponiveis.map((letra) => {
          const sel = resposta === letra;
          return (
            <Pressable key={letra} onPress={() => onSetLetra(questao.id, letra)}
              style={[styles.letraButton, sel && styles.letraButtonSelected]}>
              <Text style={[styles.letraText, sel && styles.letraTextSelected]}>{letra}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const ManualSection = React.memo(({ avaliacaoId, alunoId, questoesAvaliacao, questoesLoading, manualRespostas, setLetra, clearLetra, submittingManual, requestError, onSubmit }) => {
  if (!avaliacaoId || !alunoId) return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Correção Manual</Text>
      <Text style={styles.hintText}>Selecione a avaliação e o aluno na seção acima para continuar.</Text>
    </View>
  );

  if (questoesLoading) return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Correção Manual</Text>
      <ActivityIndicator style={{ marginVertical: 12 }} />
      <Text style={styles.hintText}>Carregando questões...</Text>
    </View>
  );

  if (questoesAvaliacao.length === 0) return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Correção Manual</Text>
      <Text style={styles.hintText}>A avaliação selecionada não possui questões vinculadas.</Text>
    </View>
  );

  const respondidas = Object.keys(manualRespostas).length;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Correção Manual</Text>
      <Text style={styles.hintText}>Toque na letra que o aluno marcou em cada questão.</Text>

      {questoesAvaliacao.map((q, idx) => (
        <QuestaoItem
          key={q.id}
          questao={q}
          idx={idx}
          resposta={manualRespostas[q.id]}
          onSetLetra={setLetra}
          onClearLetra={clearLetra}
        />
      ))}

      <Text style={[styles.hintText, { textAlign: "center" }]}>
        Respondidas: {respondidas}/{questoesAvaliacao.length}
      </Text>

      <ActionButton
        title={submittingManual ? "Salvando..." : "Salvar Correção Manual"}
        onPress={onSubmit}
        disabled={submittingManual || respondidas === 0}
      />
      {requestError ? <Text style={styles.errorText}>{requestError}</Text> : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  loginScrollContent: { flexGrow: 1, padding: 20, justifyContent: "center", gap: 18 },
  loaderContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loginHero: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: "700", color: "#0f766e", textTransform: "uppercase", letterSpacing: 1 },
  loginTitle: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  loginContainer: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#dbe2ea", padding: 18, gap: 14, elevation: 2 },
  headerCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 16, gap: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerActions: { flexDirection: "row", gap: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  subtitle: { fontSize: 13, color: "#475569" },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#dbe2ea", padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  fieldBlock: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: "#334155" },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: "#0f172a" },
  codeInput: { textAlign: "center", fontSize: 30, fontWeight: "900", letterSpacing: 8 },
  selectionField: { borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#f8fafc", padding: 12 },
  selectionFieldDisabled: { opacity: 0.55 },
  selectionFieldPressed: { opacity: 0.8 },
  selectionFieldTextBlock: { gap: 4 },
  selectionFieldValue: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  selectionFieldPlaceholder: { fontSize: 15, color: "#94a3b8" },
  selectionFieldAction: { fontSize: 11, fontWeight: "700", color: "#0f766e", textTransform: "uppercase" },
  rowButtons: { flexDirection: "row", gap: 8 },
  rowButtonItem: { flex: 1 },
  buttonBase: { borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buttonPrimary: { backgroundColor: "#0f766e" },
  buttonSecondary: { backgroundColor: "#e2e8f0" },
  buttonGhost: { backgroundColor: "#dbeafe" },
  buttonDanger: { backgroundColor: "#b91c1c" },
  buttonPressed: { opacity: 0.75 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  buttonTextLight: { color: "#fff" },
  buttonTextDark: { color: "#0f172a" },
  previewImage: { width: "100%", height: 200, borderRadius: 12, backgroundColor: "#e2e8f0" },
  scannerScreen: { flex: 1, backgroundColor: "#f3f4f6", padding: 16, gap: 12 },
  cameraWrapper: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#0f172a" },
  camera: { flex: 1 },
  permissionCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 12, backgroundColor: "#fff" },
  modalScreen: { flex: 1, backgroundColor: "#f3f4f6", padding: 16, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 8 },
  modalList: { gap: 10, paddingBottom: 24 },
  modalItem: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#dbe2ea", padding: 14, gap: 4 },
  modalItemSelected: { borderColor: "#0f766e", backgroundColor: "#ecfeff" },
  modalItemTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  modalItemSubtitle: { fontSize: 12, color: "#64748b" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#dbe2ea", padding: 16, gap: 6 },
  hintText: { fontSize: 12, color: "#64748b" },
  errorText: { fontSize: 13, color: "#b91c1c", fontWeight: "700" },
  modeToggle: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  modeTab: { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#f8fafc" },
  modeTabActive: { backgroundColor: "#0f766e" },
  modeTabText: { fontSize: 14, fontWeight: "700", color: "#64748b" },
  modeTabTextActive: { color: "#fff" },
  questaoBlock: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, gap: 8, backgroundColor: "#fafafa" },
  questaoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questaoNumero: { fontSize: 14, fontWeight: "800", color: "#0f766e" },
  questaoEnunciado: { fontSize: 12, color: "#475569" },
  letrasRow: { flexDirection: "row", gap: 8 },
  letraButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" },
  letraButtonSelected: { backgroundColor: "#0f766e" },
  letraText: { fontSize: 15, fontWeight: "800", color: "#334155" },
  letraTextSelected: { color: "#fff" },
  limparText: { fontSize: 12, color: "#b91c1c", fontWeight: "700" },
  resultGrid: { flexDirection: "row", gap: 8 },
  resultCell: { flex: 1, backgroundColor: "#ecfeff", borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  resultBigNumber: { fontSize: 20, fontWeight: "900", color: "#0f766e" },
  resultCellLabel: { fontSize: 11, color: "#475569", fontWeight: "600" },
  respostaRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  respostaCerta: { backgroundColor: "#f0fdf4" },
  respostaErrada: { backgroundColor: "#fef2f2" },
  respostaLabel: { fontSize: 13, fontWeight: "700", color: "#334155", width: 30 },
  respostaLetra: { fontSize: 15, fontWeight: "800", color: "#0f172a", flex: 1 },
  respostaCertaText: { fontSize: 16, color: "#16a34a", fontWeight: "900" },
  respostaErradaText: { fontSize: 16, color: "#dc2626", fontWeight: "900" },
  detectedCard: { backgroundColor: "#ecfeff", borderRadius: 12, borderWidth: 1, borderColor: "#99f6e4", padding: 12, gap: 3 },
  detectedLabel: { fontSize: 11, fontWeight: "700", color: "#0f766e", textTransform: "uppercase", letterSpacing: 0.5 },
  detectedValue: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  detectedSub: { fontSize: 13, color: "#475569" },
  codeBlock: { fontFamily: "monospace", fontSize: 12, color: "#0f172a", backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 10 },
});

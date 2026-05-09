import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  apiListEntities,
  apiLogin,
  apiMe,
} from "./src/api/client";
import { parseQrPayload } from "./src/utils/qrParser";

const TOKEN_STORAGE_KEY = "edtech_mobile_token";

const STATUS_LABELS = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  aplicada: "Aplicada",
  corrigida: "Corrigida",
};

const shortId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 18) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-6)}`;
};

const isAuthError = (message) => /token|sessao|sessão|401/i.test(String(message || ""));

const ActionButton = ({ title, onPress, variant = "primary", disabled = false }) => {
  const buttonStyle = useMemo(() => {
    if (variant === "ghost") return styles.buttonGhost;
    if (variant === "danger") return styles.buttonDanger;
    return styles.buttonPrimary;
  }, [variant]);

  const textStyle = useMemo(() => {
    if (variant === "ghost") return styles.buttonTextDark;
    return styles.buttonTextLight;
  }, [variant]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonBase,
        buttonStyle,
        (pressed || disabled) && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </Pressable>
  );
};

const SelectionField = ({ label, value, placeholder, helperText, onPress, disabled = false }) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.label}>{label}</Text>
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.selectionField,
        disabled && styles.selectionFieldDisabled,
        pressed && !disabled && styles.selectionFieldPressed,
      ]}
    >
      <View style={styles.selectionFieldTextBlock}>
        <Text style={value ? styles.selectionFieldValue : styles.selectionFieldPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.selectionFieldAction}>{disabled ? "Indisponivel" : "Selecionar"}</Text>
      </View>
    </Pressable>
    {helperText ? <Text style={styles.hintText}>{helperText}</Text> : null}
  </View>
);

const SelectionModal = ({
  visible,
  title,
  items,
  emptyMessage,
  selectedId,
  getTitle,
  getSubtitle,
  onSelect,
  onClose,
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalScreen}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Dados carregados diretamente do backend.</Text>
        </View>
        <ActionButton title="Fechar" variant="ghost" onPress={onClose} />
      </View>

      <ScrollView contentContainerStyle={styles.modalList}>
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>Nada para selecionar</Text>
            <Text style={styles.subtitle}>{emptyMessage}</Text>
          </View>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.modalItem,
                  isSelected && styles.modalItemSelected,
                  pressed && styles.selectionFieldPressed,
                ]}
              >
                <Text style={styles.modalItemTitle}>{getTitle(item)}</Text>
                {getSubtitle(item) ? <Text style={styles.modalItemSubtitle}>{getSubtitle(item)}</Text> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

const LoginScreen = ({ onLogin, loading, errorMessage }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.loginScrollContent}>
        <View style={styles.loginHero}>
          <Text style={styles.eyebrow}>EdTech Assess</Text>
          <Text style={styles.loginTitle}>Entrar no app mobile</Text>
          <Text style={styles.subtitle}>
            Autentique com um usuario real do backend para corrigir provas e registrar resultados no banco.
          </Text>
        </View>

        <View style={styles.loginContainer}>
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Digite sua senha"
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <ActionButton
            title={loading ? "Entrando..." : "Entrar"}
            disabled={loading || !email.trim() || !password}
            onPress={() => onLogin(email.trim(), password)}
          />

          <Text style={styles.hintText}>API configurada: {API_BASE_URL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const buildImagePayload = (asset) => {
  const base64 = String(asset?.base64 || "").trim();
  if (!base64) {
    throw new Error("A imagem precisa estar em base64 para envio.");
  }

  if (base64.startsWith("data:")) {
    return base64;
  }

  const mimeType = asset?.mimeType || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [avaliacoes, setAvaliacoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [versao, setVersao] = useState("");
  const [imageAsset, setImageAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [pickerMode, setPickerMode] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const selectedAvaliacao = useMemo(
    () => avaliacoes.find((item) => item.id === avaliacaoId) || null,
    [avaliacoes, avaliacaoId]
  );
  const availableAlunos = useMemo(() => {
    if (!selectedAvaliacao?.turma_id) return alunos;
    return alunos.filter((item) => item.turma_id === selectedAvaliacao.turma_id);
  }, [alunos, selectedAvaliacao]);
  const selectedAluno = useMemo(
    () => availableAlunos.find((item) => item.id === alunoId) || alunos.find((item) => item.id === alunoId) || null,
    [availableAlunos, alunos, alunoId]
  );

  const loadOperationalData = async (authToken) => {
    setDataLoading(true);
    setDataError("");

    try {
      const [avaliacoesData, alunosData] = await Promise.all([
        apiListEntities(authToken, "avaliacoes"),
        apiListEntities(authToken, "alunos"),
      ]);

      const sortedAvaliacoes = [...(Array.isArray(avaliacoesData) ? avaliacoesData : [])].sort((a, b) =>
        String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
      );
      const sortedAlunos = [...(Array.isArray(alunosData) ? alunosData : [])].sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""))
      );

      setAvaliacoes(sortedAvaliacoes);
      setAlunos(sortedAlunos);
    } catch (error) {
      const message = error?.message || "Falha ao carregar dados do app.";
      setDataError(message);
      if (isAuthError(message)) {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
        setToken("");
        setUser(null);
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = (await SecureStore.getItemAsync(TOKEN_STORAGE_KEY)) || "";
        if (!storedToken) return;

        const currentUser = await apiMe(storedToken);
        setToken(storedToken);
        setUser(currentUser);
      } catch (error) {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
        setToken("");
        setUser(null);
        setAuthError(error?.message || "Falha ao restaurar sessao.");
      } finally {
        setBooting(false);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setAvaliacoes([]);
      setAlunos([]);
      setDataError("");
      setDataLoading(false);
      return;
    }

    loadOperationalData(token);
  }, [token, user]);

  useEffect(() => {
    if (!selectedAvaliacao?.turma_id || !selectedAluno?.turma_id) return;
    if (selectedAvaliacao.turma_id === selectedAluno.turma_id) return;
    setAlunoId("");
  }, [selectedAvaliacao, selectedAluno]);

  const handleLogin = async (email, password) => {
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await apiLogin({ email, password });
      if (!response?.token) {
        throw new Error("Token ausente na resposta de login.");
      }

      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, response.token);

      const currentUser = response.user || (await apiMe(response.token));
      setToken(response.token);
      setUser(currentUser);
    } catch (error) {
      setAuthError(error?.message || "Falha no login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setToken("");
    setUser(null);
    setAuthError("");
    setDataError("");
    setRequestError("");
    setResult(null);
    setImageAsset(null);
    setAvaliacaoId("");
    setAlunoId("");
    setVersao("");
    setPickerMode("");
  };

  const chooseFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a galeria para selecionar a foto da prova.");
      return;
    }

    const response = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (response.canceled) return;
    const asset = response.assets?.[0];
    if (!asset?.base64) {
      Alert.alert("Erro", "Nao foi possivel ler a imagem selecionada.");
      return;
    }

    setImageAsset(asset);
    setResult(null);
    setRequestError("");
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissao necessaria", "Autorize a camera para capturar a folha de respostas.");
      return;
    }

    const response = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (response.canceled) return;
    const asset = response.assets?.[0];
    if (!asset?.base64) {
      Alert.alert("Erro", "Nao foi possivel ler a imagem capturada.");
      return;
    }

    setImageAsset(asset);
    setResult(null);
    setRequestError("");
  };

  const handleSubmitCorrection = async () => {
    setRequestError("");

    if (!avaliacaoId || !alunoId) {
      setRequestError("Selecione uma avaliacao e um aluno, ou leia o QR Code da prova.");
      return;
    }

    if (!imageAsset) {
      setRequestError("Selecione ou capture a imagem da prova antes de corrigir.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiCorrectByOcr(token, {
        avaliacao_id: avaliacaoId.trim(),
        aluno_id: alunoId.trim(),
        image_base64: buildImagePayload(imageAsset),
      });

      setResult(response);
    } catch (error) {
      const message = error?.message || "Falha ao corrigir prova.";
      setRequestError(message);

      if (isAuthError(message)) {
        await handleLogout();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onBarcodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseQrPayload(data);
    if (!parsed) {
      Alert.alert("QR invalido", "Nao foi possivel extrair avaliacao_id e aluno_id.");
      setScanned(false);
      return;
    }

    setAvaliacaoId(parsed.avaliacaoId);
    setAlunoId(parsed.alunoId);
    setVersao(parsed.versao || "");
    setScannerVisible(false);
    setScanned(false);
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.subtitle}>Carregando sessao...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        loading={authLoading}
        errorMessage={authError}
      />
    );
  }

  const correction = result?.resultado || null;
  const recognizedText = String(result?.recognized_text || "").trim();
  const respostasMap = result?.respostas_map || null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.eyebrow}>Sessao ativa</Text>
            <Text style={styles.headerTitle}>Correção por OCR</Text>
            <Text style={styles.subtitle}>
              {user?.full_name || user?.email || "Usuario"} • {user?.role || "professor"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <ActionButton
              title={dataLoading ? "Atualizando..." : "Atualizar"}
              variant="ghost"
              disabled={dataLoading}
              onPress={() => loadOperationalData(token)}
            />
            <ActionButton title="Sair" variant="danger" onPress={handleLogout} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identificacao</Text>

          <SelectionField
            label="Avaliacao"
            value={selectedAvaliacao?.titulo || (avaliacaoId ? `ID: ${shortId(avaliacaoId)}` : "")}
            placeholder={dataLoading ? "Carregando avaliacoes..." : "Selecione uma avaliacao"}
            helperText={
              selectedAvaliacao
                ? `Status: ${STATUS_LABELS[selectedAvaliacao.status] || selectedAvaliacao.status || "Sem status"}`
                : dataError || "A lista vem do backend autenticado."
            }
            onPress={() => setPickerMode("avaliacao")}
            disabled={dataLoading}
          />

          <SelectionField
            label="Aluno"
            value={selectedAluno?.nome || (alunoId ? `ID: ${shortId(alunoId)}` : "")}
            placeholder={
              selectedAvaliacao
                ? "Selecione um aluno da turma"
                : "Selecione primeiro a avaliacao"
            }
            helperText={
              selectedAluno?.matricula
                ? `Matricula: ${selectedAluno.matricula}`
                : "Os alunos sao filtrados pela turma da avaliacao quando disponivel."
            }
            onPress={() => setPickerMode("aluno")}
            disabled={dataLoading || (!selectedAvaliacao && availableAlunos.length === 0)}
          />

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Versao da prova</Text>
            <TextInput
              style={styles.input}
              value={versao}
              onChangeText={setVersao}
              placeholder="Ex: A, B, C"
              autoCapitalize="characters"
            />
          </View>

          <ActionButton
            title="Ler QR Code"
            onPress={() => {
              setScannerVisible(true);
              setScanned(false);
            }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Folha de respostas</Text>

          <View style={styles.rowButtons}>
            <View style={styles.rowButtonItem}>
              <ActionButton title="Tirar foto" onPress={takePhoto} />
            </View>
            <View style={styles.rowButtonItem}>
              <ActionButton title="Galeria" variant="ghost" onPress={chooseFromLibrary} />
            </View>
          </View>

          {imageAsset?.uri ? (
            <Image source={{ uri: imageAsset.uri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.hintText}>Nenhuma imagem selecionada.</Text>
          )}

          <ActionButton
            title={submitting ? "Corrigindo..." : "Corrigir prova"}
            onPress={handleSubmitCorrection}
            disabled={submitting || dataLoading}
          />

          {requestError ? <Text style={styles.errorText}>{requestError}</Text> : null}
          {dataError ? <Text style={styles.errorText}>{dataError}</Text> : null}
        </View>

        {correction ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resultado</Text>
            <Text style={styles.resultLine}>Nota: {correction.nota}</Text>
            <Text style={styles.resultLine}>
              Acertos: {correction.total_acertos}/{correction.total_questoes}
            </Text>
            <Text style={styles.resultLine}>Percentual: {correction.percentual_acerto}%</Text>

            {respostasMap ? (
              <>
                <Text style={styles.label}>Respostas lidas</Text>
                <Text style={styles.codeBlock}>{JSON.stringify(respostasMap, null, 2)}</Text>
              </>
            ) : null}

            {recognizedText ? (
              <>
                <Text style={styles.label}>Previa do OCR</Text>
                <Text style={styles.codeBlock}>{recognizedText.slice(0, 700)}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.hintText}>Backend: {API_BASE_URL}</Text>
      </ScrollView>

      <SelectionModal
        visible={pickerMode === "avaliacao"}
        title="Selecionar avaliacao"
        items={avaliacoes}
        selectedId={avaliacaoId}
        emptyMessage="Cadastre uma avaliacao no sistema web para usar a correção mobile."
        getTitle={(item) => item.titulo || `Avaliacao ${shortId(item.id)}`}
        getSubtitle={(item) =>
          [STATUS_LABELS[item.status] || item.status, item.data_aplicacao || shortId(item.id)]
            .filter(Boolean)
            .join(" • ")
        }
        onSelect={(item) => {
          setAvaliacaoId(item.id);
          if (item.turma_id && selectedAluno?.turma_id && selectedAluno.turma_id !== item.turma_id) {
            setAlunoId("");
          }
          setPickerMode("");
        }}
        onClose={() => setPickerMode("")}
      />

      <SelectionModal
        visible={pickerMode === "aluno"}
        title="Selecionar aluno"
        items={availableAlunos}
        selectedId={alunoId}
        emptyMessage="Nenhum aluno disponivel para a avaliacao selecionada."
        getTitle={(item) => item.nome || `Aluno ${shortId(item.id)}`}
        getSubtitle={(item) => [item.matricula, item.email].filter(Boolean).join(" • ")}
        onSelect={(item) => {
          setAlunoId(item.id);
          setPickerMode("");
        }}
        onClose={() => setPickerMode("")}
      />

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <SafeAreaView style={styles.scannerScreen}>
          <Text style={styles.title}>Scanner de QR</Text>
          <Text style={styles.subtitle}>Aponte para o QR da prova para preencher avaliacao e aluno.</Text>

          <View style={styles.cameraWrapper}>
            {cameraPermission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            ) : (
              <View style={styles.permissionCard}>
                <Text style={styles.subtitle}>Permita acesso a camera para escanear QR Code.</Text>
                <ActionButton
                  title="Permitir camera"
                  onPress={async () => {
                    await requestCameraPermission();
                  }}
                />
              </View>
            )}
          </View>

          <View style={styles.rowButtons}>
            <View style={styles.rowButtonItem}>
              <ActionButton
                title="Ler novamente"
                variant="ghost"
                onPress={() => setScanned(false)}
              />
            </View>
            <View style={styles.rowButtonItem}>
              <ActionButton
                title="Fechar"
                variant="danger"
                onPress={() => setScannerVisible(false)}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  loginScrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    gap: 18,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loginHero: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loginTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  loginContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    padding: 18,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  selectionField: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    padding: 12,
  },
  selectionFieldDisabled: {
    opacity: 0.55,
  },
  selectionFieldPressed: {
    opacity: 0.85,
  },
  selectionFieldTextBlock: {
    gap: 6,
  },
  selectionFieldValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectionFieldPlaceholder: {
    fontSize: 15,
    color: "#64748b",
  },
  selectionFieldAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
    textTransform: "uppercase",
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8,
  },
  rowButtonItem: {
    flex: 1,
  },
  buttonBase: {
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonPrimary: {
    backgroundColor: "#0f766e",
  },
  buttonGhost: {
    backgroundColor: "#dbeafe",
  },
  buttonDanger: {
    backgroundColor: "#b91c1c",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  buttonTextLight: {
    color: "#ffffff",
  },
  buttonTextDark: {
    color: "#0f172a",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  scannerScreen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 16,
    gap: 12,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#0f172a",
  },
  camera: {
    flex: 1,
  },
  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
    backgroundColor: "#ffffff",
  },
  modalScreen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  modalList: {
    gap: 10,
    paddingBottom: 20,
  },
  modalItem: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    padding: 14,
    gap: 6,
  },
  modalItemSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfeff",
  },
  modalItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalItemSubtitle: {
    fontSize: 13,
    color: "#475569",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    padding: 16,
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    color: "#64748b",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "700",
  },
  resultLine: {
    fontSize: 14,
    color: "#0f172a",
  },
  codeBlock: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
});

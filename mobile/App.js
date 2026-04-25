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
import { API_BASE_URL, apiCorrectByOcr, apiLogin, apiMe } from "./src/api/client";
import { parseQrPayload } from "./src/utils/qrParser";

const TOKEN_STORAGE_KEY = "edtech_mobile_token";

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

const LoginScreen = ({ onLogin, loading, errorMessage }) => {
  const [email, setEmail] = useState("professor@edtech.local");
  const [password, setPassword] = useState("123456");

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.loginContainer}>
        <Text style={styles.title}>EdTech Assess Mobile</Text>
        <Text style={styles.subtitle}>Login para corrigir provas pelo celular</Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="professor@edtech.local"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="123456"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <ActionButton
          title={loading ? "Entrando..." : "Entrar"}
          disabled={loading}
          onPress={() => onLogin(email, password)}
        />

        <Text style={styles.hintText}>
          API atual: {API_BASE_URL}
        </Text>
      </View>
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

  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [versao, setVersao] = useState("");
  const [imageAsset, setImageAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
        setAuthError(error?.message || "Falha ao restaurar sessão.");
      } finally {
        setBooting(false);
      }
    };

    loadSession();
  }, []);

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
    setRequestError("");
    setResult(null);
    setImageAsset(null);
    setAvaliacaoId("");
    setAlunoId("");
    setVersao("");
  };

  const chooseFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize a galeria para selecionar a foto da prova.");
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
      Alert.alert("Erro", "Não foi possível ler a imagem selecionada.");
      return;
    }

    setImageAsset(asset);
    setResult(null);
    setRequestError("");
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Autorize a câmera para capturar a folha de respostas.");
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
      Alert.alert("Erro", "Não foi possível ler a imagem capturada.");
      return;
    }

    setImageAsset(asset);
    setResult(null);
    setRequestError("");
  };

  const handleSubmitCorrection = async () => {
    setRequestError("");

    if (!avaliacaoId || !alunoId) {
      setRequestError("Informe avaliacao_id e aluno_id, ou leia o QR Code.");
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

      if (String(message).includes("Token")) {
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
      Alert.alert("QR inválido", "Não foi possível extrair avaliacao_id e aluno_id.");
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
          <Text style={styles.subtitle}>Carregando sessão...</Text>
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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Correção por OCR</Text>
            <Text style={styles.subtitle}>
              Usuário: {user?.full_name || user?.email || "Professor"}
            </Text>
          </View>
          <ActionButton title="Sair" variant="ghost" onPress={handleLogout} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identificação</Text>
          <Text style={styles.label}>Avaliacao ID</Text>
          <TextInput
            style={styles.input}
            value={avaliacaoId}
            onChangeText={setAvaliacaoId}
            placeholder="UUID da avaliação"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Aluno ID</Text>
          <TextInput
            style={styles.input}
            value={alunoId}
            onChangeText={setAlunoId}
            placeholder="UUID do aluno"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Versão (opcional)</Text>
          <TextInput
            style={styles.input}
            value={versao}
            onChangeText={setVersao}
            placeholder="Ex: A, B, C"
          />

          <ActionButton
            title="Ler QR Code"
            onPress={() => {
              setScannerVisible(true);
              setScanned(false);
            }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Folha de Respostas</Text>
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
            title={submitting ? "Corrigindo..." : "Corrigir Prova"}
            onPress={handleSubmitCorrection}
            disabled={submitting}
          />

          {requestError ? <Text style={styles.errorText}>{requestError}</Text> : null}
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
                <Text style={styles.label}>Prévia do OCR</Text>
                <Text style={styles.codeBlock}>{recognizedText.slice(0, 700)}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.hintText}>Backend: {API_BASE_URL}</Text>
      </ScrollView>

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <SafeAreaView style={styles.scannerScreen}>
          <Text style={styles.title}>Scanner de QR</Text>
          <Text style={styles.subtitle}>Aponte para o QR da prova para preencher os IDs.</Text>

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
                <Text style={styles.subtitle}>Permita acesso à câmera para escanear QR Code.</Text>
                <ActionButton
                  title="Permitir câmera"
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
    backgroundColor: "#f5f7fb",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loginContainer: {
    margin: 16,
    marginTop: 48,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8,
  },
  rowButtonItem: {
    flex: 1,
  },
  buttonBase: {
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonPrimary: {
    backgroundColor: "#1d4ed8",
  },
  buttonGhost: {
    backgroundColor: "#e2e8f0",
  },
  buttonDanger: {
    backgroundColor: "#b91c1c",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonTextLight: {
    color: "#fff",
  },
  buttonTextDark: {
    color: "#0f172a",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  scannerScreen: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 16,
    gap: 12,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 12,
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
    backgroundColor: "#fff",
  },
  hintText: {
    fontSize: 12,
    color: "#64748b",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "600",
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
});

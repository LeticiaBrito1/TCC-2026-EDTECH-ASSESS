import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { S, C } from "../components/AppStyles";
import Btn from "../components/Btn";
import { apiCorrectByOcr, apiCreate, apiList } from "../api/client";
import { parseQrPayload } from "../utils/qrParser";

const LETRAS = ["A", "B", "C", "D", "E"];
const STATUS_LABELS = { rascunho: "Rascunho", publicada: "Publicada", aplicada: "Aplicada", corrigida: "Corrigida" };
const shortId = (v) => { const s = String(v || "").trim(); return s.length <= 18 ? s : `${s.slice(0, 8)}...${s.slice(-6)}`; };
const buildImagePayload = (asset) => {
  const b64 = String(asset?.base64 || "").trim();
  if (!b64) throw new Error("A imagem precisa estar em base64.");
  if (b64.startsWith("data:")) return b64;
  return `data:${asset?.mimeType || "image/jpeg"};base64,${b64}`;
};

const SelectionModal = React.memo(({ visible, title, items, emptyMessage, selectedId, getTitle, getSubtitle, onSelect, onClose }) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={S.screen}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={S.title}>{title}</Text>
        <Btn title="Fechar" variant="secondary" onPress={onClose} style={{ minHeight: 36 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={S.content}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyText}>{emptyMessage}</Text></View>}
        renderItem={({ item }) => (
          <Pressable style={[S.listItem, item.id === selectedId && { borderColor: C.primary, backgroundColor: C.primaryLight }]} onPress={() => onSelect(item)}>
            <Text style={S.listItemTitle}>{getTitle(item)}</Text>
            {getSubtitle(item) ? <Text style={S.listItemSub}>{getSubtitle(item)}</Text> : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  </Modal>
));

export default function CorrecaoScreen({ token }) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [questoes, setQuestoes] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const questoesLoadedRef = useRef(false);

  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [alunoId, setAlunoId] = useState("");
  const [versao, setVersao] = useState("");
  const [correctionMode, setCorrectionMode] = useState("ocr");
  const [manualRespostas, setManualRespostas] = useState({});
  const [imageAsset, setImageAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [pickerMode, setPickerMode] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const selectedAvaliacao = useMemo(() => avaliacoes.find(a => a.id === avaliacaoId) || null, [avaliacoes, avaliacaoId]);
  const availableAlunos = useMemo(() => selectedAvaliacao?.turma_id ? alunos.filter(a => a.turma_id === selectedAvaliacao.turma_id) : alunos, [alunos, selectedAvaliacao]);
  const selectedAluno = useMemo(() => availableAlunos.find(a => a.id === alunoId) || alunos.find(a => a.id === alunoId) || null, [availableAlunos, alunos, alunoId]);
  const questoesAvaliacao = useMemo(() => {
    if (!selectedAvaliacao?.questoes_ids?.length) return [];
    return selectedAvaliacao.questoes_ids.map(id => questoes.find(q => q.id === id)).filter(Boolean);
  }, [selectedAvaliacao, questoes]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [av, al] = await Promise.all([apiList(token, "avaliacoes"), apiList(token, "alunos")]);
      setAvaliacoes(Array.isArray(av) ? av : []);
      setAlunos(Array.isArray(al) ? al : []);
    } catch { }
    finally { setDataLoading(false); }
  }, [token]);

  const loadQuestoes = useCallback(async () => {
    if (questoesLoadedRef.current) return;
    try {
      const data = await apiList(token, "questoes");
      setQuestoes(Array.isArray(data) ? data : []);
      questoesLoadedRef.current = true;
    } catch { }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (correctionMode === "manual") loadQuestoes(); }, [correctionMode, loadQuestoes]);

  const chooseFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão", "Autorize a galeria."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.6, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setImageAsset(res.assets[0]); setResult(null); setRequestError("");
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão", "Autorize a câmera."); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.6, base64: true });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setImageAsset(res.assets[0]); setResult(null); setRequestError("");
  }, []);

  const handleSubmitOcr = useCallback(async () => {
    if (!imageAsset) { setRequestError("Selecione ou tire uma foto."); return; }
    setRequestError(""); setSubmitting(true);
    try {
      const payload = { image_base64: buildImagePayload(imageAsset) };
      if (avaliacaoId) payload.avaliacao_id = avaliacaoId;
      if (alunoId) payload.aluno_id = alunoId;
      setResult(await apiCorrectByOcr(token, payload));
    } catch (e) { setRequestError(e?.message || "Falha ao corrigir."); }
    finally { setSubmitting(false); }
  }, [imageAsset, avaliacaoId, alunoId, token]);

  const handleSubmitManual = useCallback(async () => {
    if (!avaliacaoId || !alunoId) { setRequestError("Selecione avaliação e aluno."); return; }
    setRequestError(""); setSubmittingManual(true);
    try {
      const respostasArray = questoesAvaliacao.map(q => {
        const resposta = manualRespostas[q.id] || "";
        return { questao_id: q.id, resposta, correta: Boolean(resposta) && resposta === String(q.gabarito || "").toUpperCase() };
      });
      const acertos = respostasArray.filter(r => r.correta).length;
      const total = respostasArray.length;
      const nota = total > 0 ? Math.round(((acertos / total) * (Number(selectedAvaliacao?.total_pontos) || 10)) * 100) / 100 : 0;
      const created = await apiCreate(token, "resultados", {
        avaliacao_id: avaliacaoId, aluno_id: alunoId, turma_id: selectedAvaliacao?.turma_id || null,
        respostas: respostasArray, nota, total_acertos: acertos, total_questoes: total,
        percentual_acerto: total > 0 ? Math.round((acertos / total) * 100) : 0, status: "corrigido",
      });
      setResult({ resultado: created, respostas_map: null, detected: null });
    } catch (e) { setRequestError(e?.message || "Falha ao salvar."); }
    finally { setSubmittingManual(false); }
  }, [avaliacaoId, alunoId, questoesAvaliacao, manualRespostas, selectedAvaliacao, token]);

  const onBarcodeScanned = useCallback(({ data }) => {
    if (scanned) return;
    setScanned(true);
    const parsed = parseQrPayload(data);
    if (!parsed) { Alert.alert("QR inválido", "Não foi possível extrair os dados."); setScanned(false); return; }
    setAvaliacaoId(parsed.avaliacaoId); setAlunoId(parsed.alunoId); setVersao(parsed.versao || "");
    setScannerVisible(false); setScanned(false);
  }, [scanned]);

  const reset = useCallback(() => { setResult(null); setImageAsset(null); setRequestError(""); setManualRespostas({}); }, []);

  if (result?.resultado) {
    const r = result.resultado;
    const notaColor = Number(r.nota) >= 7 ? C.success : Number(r.nota) >= 5 ? C.warning : C.danger;
    return (
      <SafeAreaView style={S.screen}>
        <ScrollView contentContainerStyle={S.content}>
          <View style={{ backgroundColor: C.dark, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: C.white, fontSize: 18, fontWeight: "800" }}>Correção Concluída ✓</Text>
          </View>
          <View style={S.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16 }}>
              <View style={{ alignItems: "center" }}><Text style={{ fontSize: 36, fontWeight: "900", color: notaColor }}>{r.nota}</Text><Text style={S.muted}>Nota</Text></View>
              <View style={{ alignItems: "center" }}><Text style={{ fontSize: 28, fontWeight: "900", color: C.primary }}>{r.total_acertos}/{r.total_questoes}</Text><Text style={S.muted}>Acertos</Text></View>
              <View style={{ alignItems: "center" }}><Text style={{ fontSize: 28, fontWeight: "900", color: C.primary }}>{r.percentual_acerto}%</Text><Text style={S.muted}>Aproveitamento</Text></View>
            </View>
            {r.respostas?.map((resp, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={S.muted}>Q{idx + 1}</Text>
                <Text style={{ flex: 1, fontWeight: "700", color: resp.correta ? C.success : C.danger }}>{resp.resposta || "—"}</Text>
                <Text style={{ color: resp.correta ? C.success : C.danger, fontSize: 16, fontWeight: "900" }}>{resp.correta ? "✓" : "✗"}</Text>
              </View>
            ))}
          </View>
          <Btn title="Corrigir outra prova" onPress={reset} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.screen}>
      <ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
        <Text style={[S.title, { marginBottom: 16 }]}>Correção</Text>

        <View style={S.card}>
          <Text style={S.sectionTitle}>Identificação</Text>
          <View style={S.fieldBlock}>
            <Text style={S.label}>Avaliação</Text>
            <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setPickerMode("avaliacao")}>
              <Text style={{ color: selectedAvaliacao ? C.dark : C.placeholder }}>{selectedAvaliacao?.titulo || (dataLoading ? "Carregando..." : "Selecionar avaliação...")}</Text>
            </Pressable>
          </View>
          <View style={S.fieldBlock}>
            <Text style={S.label}>Aluno</Text>
            <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setPickerMode("aluno")}>
              <Text style={{ color: selectedAluno ? C.dark : C.placeholder }}>{selectedAluno?.nome || "Selecionar aluno..."}</Text>
            </Pressable>
          </View>
          <Btn title="📷  Ler QR Code da prova" variant="ghost" onPress={() => { setScannerVisible(true); setScanned(false); }} />
        </View>

        <View style={S.card}>
          <Text style={S.sectionTitle}>Método</Text>
          <View style={{ flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
            {[["ocr", "📸 Foto (OCR)"], ["manual", "✏️ Manual"]].map(([mode, label]) => (
              <Pressable key={mode} style={{ flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: correctionMode === mode ? C.primary : C.inputBg }} onPress={() => setCorrectionMode(mode)}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: correctionMode === mode ? C.white : C.muted }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {correctionMode === "ocr" && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>Cartão Resposta</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn title="📷 Foto" onPress={takePhoto} style={{ flex: 1 }} />
              <Btn title="🖼 Galeria" variant="ghost" onPress={chooseFromLibrary} style={{ flex: 1 }} />
            </View>
            {imageAsset?.uri ? <Image source={{ uri: imageAsset.uri }} style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 8 }} /> : <Text style={[S.muted, { textAlign: "center" }]}>Nenhuma imagem</Text>}
            <Btn title={submitting ? "Analisando..." : "Corrigir por OCR"} onPress={handleSubmitOcr} disabled={submitting || !imageAsset} loading={submitting} />
            {requestError ? <Text style={S.errorText}>{requestError}</Text> : null}
          </View>
        )}

        {correctionMode === "manual" && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>Correção Manual</Text>
            {(!avaliacaoId || !alunoId)
              ? <Text style={S.muted}>Selecione avaliação e aluno acima.</Text>
              : questoesAvaliacao.length === 0
                ? <Text style={S.muted}>A avaliação não possui questões.</Text>
                : <>
                  {questoesAvaliacao.map((q, idx) => (
                    <View key={q.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <Text style={S.body} numberOfLines={2}>Q{idx + 1}. {q.enunciado}</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                        {(q.alternativas?.map(a => a.letra) || LETRAS.slice(0, 4)).map(letra => {
                          const sel = manualRespostas[q.id] === letra;
                          return (
                            <Pressable key={letra} onPress={() => setManualRespostas(p => ({ ...p, [q.id]: letra }))}
                              style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: sel ? C.primary : C.secondary }}>
                              <Text style={{ fontWeight: "800", color: sel ? C.white : C.dark }}>{letra}</Text>
                            </Pressable>
                          );
                        })}
                        {manualRespostas[q.id] && (
                          <Pressable onPress={() => setManualRespostas(p => { const n = { ...p }; delete n[q.id]; return n; })}
                            style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: C.dangerBg }}>
                            <Text style={{ color: C.danger, fontWeight: "800" }}>✕</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                  <Btn title={submittingManual ? "Salvando..." : "Salvar Correção"} onPress={handleSubmitManual} loading={submittingManual} disabled={Object.keys(manualRespostas).length === 0} />
                  {requestError ? <Text style={S.errorText}>{requestError}</Text> : null}
                </>
            }
          </View>
        )}
      </ScrollView>

      <SelectionModal visible={pickerMode === "avaliacao"} title="Avaliação" items={avaliacoes} selectedId={avaliacaoId} emptyMessage="Nenhuma avaliação cadastrada."
        getTitle={i => i.titulo} getSubtitle={i => `${STATUS_LABELS[i.status] || i.status} · ${i.questoes_ids?.length || 0} questões`}
        onSelect={i => { setAvaliacaoId(i.id); setPickerMode(""); }} onClose={() => setPickerMode("")} />
      <SelectionModal visible={pickerMode === "aluno"} title="Aluno" items={availableAlunos} selectedId={alunoId} emptyMessage="Nenhum aluno disponível."
        getTitle={i => i.nome} getSubtitle={i => i.matricula ? `Matrícula: ${i.matricula}` : ""}
        onSelect={i => { setAlunoId(i.id); setPickerMode(""); }} onClose={() => setPickerMode("")} />

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.dark, padding: 16, gap: 12 }}>
          <Text style={{ color: C.white, fontSize: 18, fontWeight: "800" }}>Scanner QR</Text>
          <View style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}>
            {cameraPermission?.granted
              ? <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onBarcodeScanned} />
              : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
                <Text style={{ color: C.white }}>Permita acesso à câmera.</Text>
                <Btn title="Permitir" onPress={requestCameraPermission} />
              </View>}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn title="Ler novamente" variant="ghost" onPress={() => setScanned(false)} style={{ flex: 1 }} />
            <Btn title="Fechar" variant="danger" onPress={() => setScannerVisible(false)} style={{ flex: 1 }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

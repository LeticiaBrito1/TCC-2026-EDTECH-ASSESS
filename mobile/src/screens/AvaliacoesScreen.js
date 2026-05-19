import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, RefreshControl, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList, apiCreate, apiUpdate, apiDelete } from "../api/client";
import Btn from "../components/Btn";
import FormModal from "../components/FormModal";
import FieldInput from "../components/FieldInput";

const STATUS = { rascunho: "Rascunho", publicada: "Publicada", aplicada: "Aplicada", corrigida: "Corrigida" };
const STATUS_COLORS = { rascunho: C.muted, publicada: C.primary, aplicada: C.warning, corrigida: C.success };

const empty = () => ({ titulo: "", descricao: "", turma_id: "", disciplina_id: "", status: "rascunho", total_pontos: "10", data_aplicacao: "" });

export default function AvaliacoesScreen({ token }) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [questoes, setQuestoes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [pickerType, setPickerType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [av, t, d, q] = await Promise.all([
        apiList(token, "avaliacoes"),
        apiList(token, "turmas"),
        apiList(token, "disciplinas"),
        apiList(token, "questoes"),
      ]);
      setAvaliacoes(Array.isArray(av) ? av : []);
      setTurmas(Array.isArray(t) ? t : []);
      setDisciplinas(Array.isArray(d) ? d : []);
      setQuestoes(Array.isArray(q) ? q : []);
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openEdit = (av) => {
    setEditing(av);
    setForm({ titulo: av.titulo || "", descricao: av.descricao || "", turma_id: av.turma_id || "", disciplina_id: av.disciplina_id || "", status: av.status || "rascunho", total_pontos: String(av.total_pontos || "10"), data_aplicacao: av.data_aplicacao || "" });
    setDetailOpen(false);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.titulo.trim()) { Alert.alert("Atenção", "Título é obrigatório."); return; }
    setSaving(true);
    try {
      const payload = { ...form, total_pontos: Number(form.total_pontos) || 10 };
      if (editing) await apiUpdate(token, "avaliacoes", editing.id, payload);
      else await apiCreate(token, "avaliacoes", payload);
      setModalOpen(false);
      load();
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSaving(false); }
  };

  const del = (av) => Alert.alert("Excluir", `Excluir "${av.titulo}"?`, [
    { text: "Cancelar" },
    { text: "Excluir", style: "destructive", onPress: async () => { try { await apiDelete(token, "avaliacoes", av.id); load(); setDetailOpen(false); } catch (e) { Alert.alert("Erro", e.message); } } },
  ]);

  const getTurma = (id) => turmas.find(t => t.id === id);
  const getDisciplina = (id) => disciplinas.find(d => d.id === id);
  const getQuestoes = (ids) => (ids || []).map(id => questoes.find(q => q.id === id)).filter(Boolean);

  const filtered = avaliacoes.filter(av =>
    av.titulo?.toLowerCase().includes(search.toLowerCase())
  );

  const pickerData = pickerType === "turma" ? turmas : pickerType === "disciplina" ? disciplinas : [];
  const pickerTitle = pickerType === "turma" ? "Turma" : "Disciplina";
  const pickerValue = pickerType === "turma" ? form.turma_id : form.disciplina_id;

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[S.rowBetween, { marginBottom: 12 }]}>
          <Text style={S.title}>Avaliações</Text>
          <Btn title="+ Nova" onPress={() => { setEditing(null); setForm(empty()); setModalOpen(true); }} style={{ paddingHorizontal: 16, minHeight: 38 }} />
        </View>
        <TextInput style={S.searchBox} placeholder="Buscar avaliações..." value={search} onChangeText={setSearch} placeholderTextColor={C.placeholder} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>📋</Text><Text style={S.emptyTitle}>Nenhuma avaliação</Text></View>}
        renderItem={({ item: av }) => (
          <Pressable style={S.listItem} onPress={() => { setSelected(av); setDetailOpen(true); }}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={S.listItemTitle}>{av.titulo}</Text>
                <Text style={S.listItemSub}>
                  {av.questoes_ids?.length || 0} questões · {av.total_pontos || 0} pts
                  {getTurma(av.turma_id) ? ` · ${getTurma(av.turma_id).nome}` : ""}
                </Text>
              </View>
              <View style={[S.badge, { backgroundColor: (STATUS_COLORS[av.status] || C.muted) + "20" }]}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLORS[av.status] || C.muted }}>{STATUS[av.status] || av.status}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* Detalhe */}
      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[S.title, { flex: 1 }]} numberOfLines={1}>{selected?.titulo}</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setDetailOpen(false)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
          </View>
          <ScrollView contentContainerStyle={S.content}>
            <View style={S.card}>
              {[
                ["Status", STATUS[selected?.status] || selected?.status],
                ["Pontos", `${selected?.total_pontos || 0} pts`],
                ["Questões", `${selected?.questoes_ids?.length || 0}`],
                ["Turma", getTurma(selected?.turma_id)?.nome || "—"],
                ["Disciplina", getDisciplina(selected?.disciplina_id)?.nome || "—"],
                ["Data Aplicação", selected?.data_aplicacao || "—"],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={S.muted}>{k}</Text>
                  <Text style={S.body}>{v}</Text>
                </View>
              ))}
            </View>
            {getQuestoes(selected?.questoes_ids).length > 0 && (
              <View style={S.card}>
                <Text style={S.sectionTitle}>Questões</Text>
                {getQuestoes(selected?.questoes_ids).map((q, idx) => (
                  <View key={q.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={S.body} numberOfLines={2}>{idx + 1}. {q.enunciado}</Text>
                    <Text style={S.muted}>Gabarito: {q.gabarito}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn title="Editar" onPress={() => openEdit(selected)} style={{ flex: 1 }} />
              <Btn title="Excluir" variant="danger" onPress={() => del(selected)} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Picker genérico */}
      <Modal visible={!!pickerType} animationType="slide" onRequestClose={() => setPickerType("")}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.title}>{pickerTitle}</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setPickerType("")} style={{ minHeight: 36 }} />
          </View>
          <FlatList
            data={pickerData}
            keyExtractor={i => i.id}
            contentContainerStyle={S.content}
            ListHeaderComponent={
              <Pressable style={[S.listItem, !pickerValue && { borderColor: C.primary, backgroundColor: C.primaryLight }]}
                onPress={() => { setForm(f => ({ ...f, [pickerType === "turma" ? "turma_id" : "disciplina_id"]: "" })); setPickerType(""); }}>
                <Text style={S.listItemTitle}>Sem {pickerTitle.toLowerCase()}</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable style={[S.listItem, pickerValue === item.id && { borderColor: C.primary, backgroundColor: C.primaryLight }]}
                onPress={() => { setForm(f => ({ ...f, [pickerType === "turma" ? "turma_id" : "disciplina_id"]: item.id })); setPickerType(""); }}>
                <Text style={S.listItemTitle}>{item.nome || item.titulo}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      <FormModal visible={modalOpen} title={editing ? "Editar Avaliação" : "Nova Avaliação"} onClose={() => setModalOpen(false)} onSave={save} saving={saving}>
        <FieldInput label="Título *" value={form.titulo} onChangeText={v => setForm({ ...form, titulo: v })} placeholder="Ex: Prova de Matemática" />
        <FieldInput label="Total de Pontos" value={form.total_pontos} onChangeText={v => setForm({ ...form, total_pontos: v })} keyboardType="numeric" placeholder="Ex: 10" />
        <FieldInput label="Data de Aplicação" value={form.data_aplicacao} onChangeText={v => setForm({ ...form, data_aplicacao: v })} placeholder="YYYY-MM-DD" />
        <View style={S.fieldBlock}>
          <Text style={S.label}>Turma</Text>
          <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setPickerType("turma")}>
            <Text style={{ color: form.turma_id ? C.dark : C.placeholder }}>{getTurma(form.turma_id)?.nome || "Selecionar turma..."}</Text>
          </Pressable>
        </View>
        <View style={S.fieldBlock}>
          <Text style={S.label}>Disciplina</Text>
          <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setPickerType("disciplina")}>
            <Text style={{ color: form.disciplina_id ? C.dark : C.placeholder }}>{getDisciplina(form.disciplina_id)?.nome || "Selecionar disciplina..."}</Text>
          </Pressable>
        </View>
        <View style={S.fieldBlock}>
          <Text style={S.label}>Status</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <Pressable key={k} onPress={() => setForm({ ...form, status: k })}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: form.status === k ? C.primary : C.border, backgroundColor: form.status === k ? C.primaryLight : C.white }}>
                <Text style={{ fontSize: 13, color: form.status === k ? C.primary : C.muted, fontWeight: form.status === k ? "700" : "400" }}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <FieldInput label="Descrição" value={form.descricao} onChangeText={v => setForm({ ...form, descricao: v })} placeholder="Descrição opcional" multiline numberOfLines={3} />
      </FormModal>
    </SafeAreaView>
  );
}

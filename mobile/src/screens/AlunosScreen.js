import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, RefreshControl, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList, apiCreate, apiUpdate, apiDelete } from "../api/client";
import Btn from "../components/Btn";
import FormModal from "../components/FormModal";
import FieldInput from "../components/FieldInput";

const empty = () => ({ nome: "", email: "", matricula: "", turma_id: "", ativo: true });

export default function AlunosScreen({ token }) {
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [turmaPickerOpen, setTurmaPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t, r, av] = await Promise.all([
        apiList(token, "alunos"),
        apiList(token, "turmas"),
        apiList(token, "resultados"),
        apiList(token, "avaliacoes"),
      ]);
      setAlunos(Array.isArray(a) ? a : []);
      setTurmas(Array.isArray(t) ? t : []);
      setResultados(Array.isArray(r) ? r : []);
      setAvaliacoes(Array.isArray(av) ? av : []);
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ nome: a.nome, email: a.email || "", matricula: String(a.matricula || ""), turma_id: a.turma_id || "", ativo: a.ativo !== false });
    setModalOpen(true);
  };
  const openDetail = (a) => { setSelected(a); setDetailOpen(true); };

  const save = async () => {
    if (!form.nome.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    setSaving(true);
    try {
      if (editing) await apiUpdate(token, "alunos", editing.id, form);
      else await apiCreate(token, "alunos", form);
      setModalOpen(false);
      load();
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSaving(false); }
  };

  const del = (a) => Alert.alert("Excluir", `Excluir "${a.nome}"?`, [
    { text: "Cancelar" },
    { text: "Excluir", style: "destructive", onPress: async () => { try { await apiDelete(token, "alunos", a.id); load(); } catch (e) { Alert.alert("Erro", e.message); } } },
  ]);

  const getTurma = (id) => turmas.find(t => t.id === id);
  const getResultados = (id) => resultados.filter(r => r.aluno_id === id);
  const getAvaliacaoTitulo = (id) => avaliacoes.find(a => a.id === id)?.titulo || "—";

  const filtered = alunos.filter(a =>
    a.nome?.toLowerCase().includes(search.toLowerCase()) ||
    String(a.matricula ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const turmaSelecionada = turmas.find(t => t.id === form.turma_id);

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[S.rowBetween, { marginBottom: 12 }]}>
          <Text style={S.title}>Alunos</Text>
          <Btn title="+ Novo" onPress={openNew} style={{ paddingHorizontal: 16, minHeight: 38 }} />
        </View>
        <TextInput style={S.searchBox} placeholder="Buscar por nome ou matrícula..." value={search} onChangeText={setSearch} placeholderTextColor={C.placeholder} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>👩‍🎓</Text><Text style={S.emptyTitle}>Nenhum aluno</Text><Text style={S.emptyText}>Cadastre seu primeiro aluno</Text></View>}
        renderItem={({ item: a }) => (
          <Pressable style={S.listItem} onPress={() => openDetail(a)}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={S.listItemTitle}>{a.nome}</Text>
                <Text style={S.listItemSub}>
                  {a.matricula ? `Matrícula: ${a.matricula}` : "Sem matrícula"}
                  {getTurma(a.turma_id) ? ` · ${getTurma(a.turma_id).nome}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[S.badge, a.ativo !== false ? S.badgePrimary : S.badgeSecondary]}>
                  <Text style={a.ativo !== false ? S.badgeTextPrimary : S.badgeTextSecondary}>{a.ativo !== false ? "Ativo" : "Inativo"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Btn title="Editar" variant="ghost" onPress={() => openEdit(a)} style={{ minHeight: 30, paddingHorizontal: 10 }} />
                  <Btn title="Excluir" variant="danger" onPress={() => del(a)} style={{ minHeight: 30, paddingHorizontal: 10 }} />
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* Modal detalhe */}
      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={S.title}>{selected?.nome}</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setDetailOpen(false)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
          </View>
          <ScrollView contentContainerStyle={S.content}>
            <View style={S.card}>
              <Text style={S.sectionTitle}>Informações</Text>
              {[["Matrícula", selected?.matricula || "—"], ["Email", selected?.email || "—"], ["Turma", getTurma(selected?.turma_id)?.nome || "—"], ["Status", selected?.ativo !== false ? "Ativo" : "Inativo"]].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={S.muted}>{k}</Text>
                  <Text style={S.body}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={S.card}>
              <Text style={S.sectionTitle}>Notas ({getResultados(selected?.id).length})</Text>
              {getResultados(selected?.id).length === 0
                ? <Text style={S.muted}>Nenhuma correção registrada.</Text>
                : getResultados(selected?.id).map(r => (
                  <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.listItemTitle}>{getAvaliacaoTitulo(r.avaliacao_id)}</Text>
                      <Text style={S.listItemSub}>{r.total_acertos}/{r.total_questoes} acertos</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: C.primary }}>{r.nota}</Text>
                  </View>
                ))}
            </View>
            <Btn title="Editar Aluno" onPress={() => { setDetailOpen(false); openEdit(selected); }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Picker de turma */}
      <Modal visible={turmaPickerOpen} animationType="slide" onRequestClose={() => setTurmaPickerOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.title}>Selecionar Turma</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setTurmaPickerOpen(false)} style={{ minHeight: 36 }} />
          </View>
          <FlatList
            data={turmas}
            keyExtractor={i => i.id}
            contentContainerStyle={S.content}
            ListHeaderComponent={
              <Pressable style={[S.listItem, !form.turma_id && { borderColor: C.primary, backgroundColor: C.primaryLight }]}
                onPress={() => { setForm({ ...form, turma_id: "" }); setTurmaPickerOpen(false); }}>
                <Text style={S.listItemTitle}>Sem turma</Text>
              </Pressable>
            }
            renderItem={({ item: t }) => (
              <Pressable style={[S.listItem, form.turma_id === t.id && { borderColor: C.primary, backgroundColor: C.primaryLight }]}
                onPress={() => { setForm({ ...form, turma_id: t.id }); setTurmaPickerOpen(false); }}>
                <Text style={S.listItemTitle}>{t.nome}</Text>
                <Text style={S.listItemSub}>{t.ano_letivo} · {t.periodo}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      <FormModal visible={modalOpen} title={editing ? "Editar Aluno" : "Novo Aluno"} onClose={() => setModalOpen(false)} onSave={save} saving={saving}>
        <FieldInput label="Nome *" value={form.nome} onChangeText={v => setForm({ ...form, nome: v })} placeholder="Nome completo" />
        <FieldInput label="Matrícula" value={form.matricula} onChangeText={v => setForm({ ...form, matricula: v })} placeholder="Ex: 2025001" keyboardType="default" />
        <FieldInput label="Email" value={form.email} onChangeText={v => setForm({ ...form, email: v })} placeholder="email@escola.com" keyboardType="email-address" autoCapitalize="none" />
        <View style={S.fieldBlock}>
          <Text style={S.label}>Turma</Text>
          <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setTurmaPickerOpen(true)}>
            <Text style={{ color: turmaSelecionada ? C.dark : C.placeholder }}>
              {turmaSelecionada ? turmaSelecionada.nome : "Selecionar turma..."}
            </Text>
          </Pressable>
        </View>
        <View style={S.fieldBlock}>
          <Text style={S.label}>Status</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["Ativo", true], ["Inativo", false]].map(([lbl, val]) => (
              <Pressable key={lbl} onPress={() => setForm({ ...form, ativo: val })}
                style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: form.ativo === val ? C.primary : C.border, backgroundColor: form.ativo === val ? C.primaryLight : C.white, alignItems: "center" }}>
                <Text style={{ color: form.ativo === val ? C.primary : C.muted, fontWeight: "700" }}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}

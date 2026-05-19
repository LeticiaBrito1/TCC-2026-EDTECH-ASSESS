import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList, apiCreate, apiUpdate, apiDelete } from "../api/client";
import Btn from "../components/Btn";
import FormModal from "../components/FormModal";
import FieldInput from "../components/FieldInput";

const empty = () => ({ nome: "", codigo: "", descricao: "", turma_id: "", carga_horaria: "" });

export default function DisciplinasScreen({ token }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [turmaPickerOpen, setTurmaPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([apiList(token, "disciplinas"), apiList(token, "turmas")]);
      setDisciplinas(Array.isArray(d) ? d : []);
      setTurmas(Array.isArray(t) ? t : []);
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openEdit = (d) => { setEditing(d); setForm({ nome: d.nome, codigo: d.codigo || "", descricao: d.descricao || "", turma_id: d.turma_id || "", carga_horaria: String(d.carga_horaria || "") }); setModalOpen(true); };
  const openNew = () => { setEditing(null); setForm(empty()); setModalOpen(true); };

  const save = async () => {
    if (!form.nome.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    setSaving(true);
    try {
      const payload = { ...form, carga_horaria: form.carga_horaria ? Number(form.carga_horaria) : null };
      if (editing) await apiUpdate(token, "disciplinas", editing.id, payload);
      else await apiCreate(token, "disciplinas", payload);
      setModalOpen(false);
      load();
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSaving(false); }
  };

  const del = (d) => Alert.alert("Excluir", `Excluir "${d.nome}"?`, [
    { text: "Cancelar" },
    { text: "Excluir", style: "destructive", onPress: async () => { try { await apiDelete(token, "disciplinas", d.id); load(); } catch (e) { Alert.alert("Erro", e.message); } } },
  ]);

  const getTurma = (id) => turmas.find(t => t.id === id);
  const filtered = disciplinas.filter(d => d.nome?.toLowerCase().includes(search.toLowerCase()) || d.codigo?.toLowerCase().includes(search.toLowerCase()));
  const turmaSelecionada = turmas.find(t => t.id === form.turma_id);

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[S.rowBetween, { marginBottom: 12 }]}>
          <Text style={S.title}>Disciplinas</Text>
          <Btn title="+ Nova" onPress={openNew} style={{ paddingHorizontal: 16, minHeight: 38 }} />
        </View>
        <TextInput style={S.searchBox} placeholder="Buscar disciplinas..." value={search} onChangeText={setSearch} placeholderTextColor={C.placeholder} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>📚</Text><Text style={S.emptyTitle}>Nenhuma disciplina</Text></View>}
        renderItem={({ item: d }) => (
          <Pressable style={S.listItem} onPress={() => openEdit(d)}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={S.listItemTitle}>{d.nome}{d.codigo ? ` (${d.codigo})` : ""}</Text>
                {getTurma(d.turma_id) ? <Text style={S.listItemSub}>Turma: {getTurma(d.turma_id).nome}</Text> : null}
                {d.carga_horaria ? <Text style={S.listItemSub}>{d.carga_horaria}h</Text> : null}
                {d.descricao ? <Text style={[S.listItemSub, { marginTop: 2 }]} numberOfLines={2}>{d.descricao}</Text> : null}
              </View>
              <Btn title="Excluir" variant="danger" onPress={() => del(d)} style={{ minHeight: 30, paddingHorizontal: 10 }} />
            </View>
          </Pressable>
        )}
      />

      <Modal visible={turmaPickerOpen} animationType="slide" onRequestClose={() => setTurmaPickerOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.title}>Turma</Text>
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

      <FormModal visible={modalOpen} title={editing ? "Editar Disciplina" : "Nova Disciplina"} onClose={() => setModalOpen(false)} onSave={save} saving={saving}>
        <FieldInput label="Nome *" value={form.nome} onChangeText={v => setForm({ ...form, nome: v })} placeholder="Ex: Matemática" />
        <FieldInput label="Código" value={form.codigo} onChangeText={v => setForm({ ...form, codigo: v })} placeholder="Ex: MAT01" autoCapitalize="characters" />
        <FieldInput label="Carga Horária (h)" value={form.carga_horaria} onChangeText={v => setForm({ ...form, carga_horaria: v })} keyboardType="numeric" placeholder="Ex: 80" />
        <View style={S.fieldBlock}>
          <Text style={S.label}>Turma</Text>
          <Pressable style={[S.input, { justifyContent: "center" }]} onPress={() => setTurmaPickerOpen(true)}>
            <Text style={{ color: turmaSelecionada ? C.dark : C.placeholder }}>
              {turmaSelecionada ? turmaSelecionada.nome : "Selecionar turma..."}
            </Text>
          </Pressable>
        </View>
        <View style={S.fieldBlock}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.label}>Descrição</Text>
            <Text style={S.muted}>{form.descricao.length}/500</Text>
          </View>
          <TextInput
            style={[S.input, { height: 80, textAlignVertical: "top" }]}
            value={form.descricao}
            onChangeText={v => setForm({ ...form, descricao: v.slice(0, 500) })}
            placeholder="Descrição da disciplina"
            multiline
            maxLength={500}
            placeholderTextColor={C.placeholder}
          />
        </View>
      </FormModal>
    </SafeAreaView>
  );
}

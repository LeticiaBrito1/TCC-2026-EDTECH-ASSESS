import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, RefreshControl, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList, apiCreate, apiUpdate, apiDelete } from "../api/client";
import Btn from "../components/Btn";
import FormModal from "../components/FormModal";
import FieldInput from "../components/FieldInput";

const DIFICULDADES = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
const LETRAS = ["A", "B", "C", "D", "E"];

const emptyAlt = () => LETRAS.slice(0, 4).map(l => ({ letra: l, texto: "" }));
const empty = () => ({ enunciado: "", nivel_dificuldade: "medio", tema: "", competencia: "", gabarito: "A", alternativas: emptyAlt() });

export default function QuestoesScreen({ token }) {
  const [questoes, setQuestoes] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDif, setFilterDif] = useState("all");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setQuestoes(await apiList(token, "questoes") || []); } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openEdit = (q) => {
    setEditing(q);
    setForm({
      enunciado: q.enunciado || "",
      nivel_dificuldade: q.nivel_dificuldade || "medio",
      tema: q.tema || "",
      competencia: q.competencia || "",
      gabarito: q.gabarito || "A",
      alternativas: q.alternativas?.length ? q.alternativas : emptyAlt(),
    });
    setDetailOpen(false);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.enunciado.trim()) { Alert.alert("Atenção", "Enunciado é obrigatório."); return; }
    setSaving(true);
    try {
      if (editing) await apiUpdate(token, "questoes", editing.id, form);
      else await apiCreate(token, "questoes", form);
      setModalOpen(false);
      load();
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSaving(false); }
  };

  const del = (q) => Alert.alert("Excluir", "Excluir esta questão?", [
    { text: "Cancelar" },
    { text: "Excluir", style: "destructive", onPress: async () => { try { await apiDelete(token, "questoes", q.id); load(); setDetailOpen(false); } catch (e) { Alert.alert("Erro", e.message); } } },
  ]);

  const updateAlt = (idx, texto) => {
    const alts = [...form.alternativas];
    alts[idx] = { ...alts[idx], texto };
    setForm({ ...form, alternativas: alts });
  };

  const difColor = { facil: C.success, medio: C.warning, dificil: C.danger };

  const filtered = questoes
    .filter(q => filterDif === "all" || q.nivel_dificuldade === filterDif)
    .filter(q => q.enunciado?.toLowerCase().includes(search.toLowerCase()) || q.tema?.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[S.rowBetween, { marginBottom: 12 }]}>
          <Text style={S.title}>Questões</Text>
          <Btn title="+ Nova" onPress={() => { setEditing(null); setForm(empty()); setModalOpen(true); }} style={{ paddingHorizontal: 16, minHeight: 38 }} />
        </View>
        <TextInput style={S.searchBox} placeholder="Buscar por enunciado ou tema..." value={search} onChangeText={setSearch} placeholderTextColor={C.placeholder} />
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
          {[["all", "Todos"], ...Object.entries(DIFICULDADES)].map(([k, v]) => (
            <Pressable key={k} onPress={() => setFilterDif(k)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: filterDif === k ? C.primary : C.white, borderWidth: 1, borderColor: filterDif === k ? C.primary : C.border }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: filterDif === k ? C.white : C.muted }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>❓</Text><Text style={S.emptyTitle}>Nenhuma questão</Text></View>}
        renderItem={({ item: q }) => (
          <Pressable style={S.listItem} onPress={() => { setSelected(q); setDetailOpen(true); }}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={S.listItemTitle} numberOfLines={2}>{q.enunciado}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  <View style={[S.badge, { backgroundColor: difColor[q.nivel_dificuldade] + "20" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: difColor[q.nivel_dificuldade] || C.muted }}>{DIFICULDADES[q.nivel_dificuldade] || q.nivel_dificuldade}</Text>
                  </View>
                  {q.tema ? <Text style={S.muted}>{q.tema}</Text> : null}
                </View>
              </View>
              <View style={[S.badge, S.badgePrimary]}>
                <Text style={[S.badgeTextPrimary, { fontSize: 16, fontWeight: "900" }]}>{q.gabarito}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />

      {/* Detalhe */}
      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={S.title}>Questão</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setDetailOpen(false)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
          </View>
          <ScrollView contentContainerStyle={S.content}>
            <View style={S.card}>
              <Text style={[S.body, { lineHeight: 22 }]}>{selected?.enunciado}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {selected?.nivel_dificuldade && <View style={[S.badge, { backgroundColor: (difColor[selected.nivel_dificuldade] || C.muted) + "20" }]}><Text style={{ fontSize: 11, fontWeight: "700", color: difColor[selected.nivel_dificuldade] || C.muted }}>{DIFICULDADES[selected.nivel_dificuldade] || selected.nivel_dificuldade}</Text></View>}
                {selected?.tema && <View style={[S.badge, S.badgeSecondary]}><Text style={S.badgeTextSecondary}>{selected.tema}</Text></View>}
                {selected?.competencia && <View style={[S.badge, S.badgeSecondary]}><Text style={S.badgeTextSecondary}>{selected.competencia}</Text></View>}
              </View>
            </View>
            {selected?.alternativas?.length > 0 && (
              <View style={S.card}>
                <Text style={S.sectionTitle}>Alternativas</Text>
                {selected.alternativas.map((a) => (
                  <View key={a.letra} style={{ flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={[S.badge, a.letra === selected.gabarito ? S.badgePrimary : S.badgeSecondary, { minWidth: 28, alignItems: "center" }]}>
                      <Text style={a.letra === selected.gabarito ? S.badgeTextPrimary : S.badgeTextSecondary}>{a.letra}</Text>
                    </View>
                    <Text style={[S.body, { flex: 1, fontWeight: a.letra === selected.gabarito ? "700" : "400" }]}>{a.texto}</Text>
                  </View>
                ))}
                <Text style={[S.muted, { marginTop: 8 }]}>Gabarito: <Text style={{ color: C.primary, fontWeight: "700" }}>{selected?.gabarito}</Text></Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn title="Editar" onPress={() => openEdit(selected)} style={{ flex: 1 }} />
              <Btn title="Excluir" variant="danger" onPress={() => del(selected)} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <FormModal visible={modalOpen} title={editing ? "Editar Questão" : "Nova Questão"} onClose={() => setModalOpen(false)} onSave={save} saving={saving}>
        <View style={S.fieldBlock}>
          <Text style={S.label}>Enunciado *</Text>
          <TextInput style={[S.input, { height: 100, textAlignVertical: "top" }]} value={form.enunciado} onChangeText={v => setForm({ ...form, enunciado: v })} placeholder="Digite o enunciado..." multiline placeholderTextColor={C.placeholder} />
        </View>
        <View style={S.fieldBlock}>
          <Text style={S.label}>Nível de Dificuldade</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Object.entries(DIFICULDADES).map(([k, v]) => (
              <Pressable key={k} onPress={() => setForm({ ...form, nivel_dificuldade: k })}
                style={{ flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: form.nivel_dificuldade === k ? difColor[k] : C.border, backgroundColor: form.nivel_dificuldade === k ? difColor[k] + "20" : C.white, alignItems: "center" }}>
                <Text style={{ color: form.nivel_dificuldade === k ? difColor[k] : C.muted, fontWeight: "700", fontSize: 12 }}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <FieldInput label="Tema" value={form.tema} onChangeText={v => setForm({ ...form, tema: v })} placeholder="Ex: Álgebra" />
        <FieldInput label="Competência" value={form.competencia} onChangeText={v => setForm({ ...form, competencia: v })} placeholder="Ex: Raciocínio lógico" />
        <View style={S.fieldBlock}>
          <Text style={S.label}>Alternativas</Text>
          {form.alternativas.map((a, idx) => (
            <View key={a.letra} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Pressable onPress={() => setForm({ ...form, gabarito: a.letra })}
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: form.gabarito === a.letra ? C.primary : C.border, backgroundColor: form.gabarito === a.letra ? C.primary : C.white, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "800", color: form.gabarito === a.letra ? C.white : C.muted }}>{a.letra}</Text>
              </Pressable>
              <TextInput style={[S.input, { flex: 1 }]} value={a.texto} onChangeText={v => updateAlt(idx, v)} placeholder={`Alternativa ${a.letra}`} placeholderTextColor={C.placeholder} />
            </View>
          ))}
          <Text style={S.muted}>Toque na letra para marcar como gabarito</Text>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}

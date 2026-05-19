import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList, apiCreate, apiUpdate, apiDelete } from "../api/client";
import Btn from "../components/Btn";
import FormModal from "../components/FormModal";
import FieldInput from "../components/FieldInput";

const PERIODOS = { matutino: "Matutino", vespertino: "Vespertino", noturno: "Noturno", integral: "Integral" };
const NIVEIS = { fundamental_1: "Fund. I", fundamental_2: "Fund. II", medio: "Médio", superior: "Superior", tecnico: "Técnico" };
const ANOS = ["2023","2024","2025","2026","2027"];

const empty = () => ({ nome: "", ano_letivo: "2025", periodo: "matutino", nivel: "medio", instituicao: "", ativa: true });

export default function TurmasScreen({ token }) {
  const [turmas, setTurmas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTurmas(await apiList(token, "turmas") || []); } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ nome: t.nome, ano_letivo: t.ano_letivo, periodo: t.periodo || "matutino", nivel: t.nivel || "medio", instituicao: t.instituicao || "", ativa: t.ativa !== false }); setModalOpen(true); };

  const save = async () => {
    if (!form.nome.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    setSaving(true);
    try {
      if (editing) await apiUpdate(token, "turmas", editing.id, form);
      else await apiCreate(token, "turmas", form);
      setModalOpen(false);
      load();
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSaving(false); }
  };

  const del = (t) => Alert.alert("Excluir", `Excluir "${t.nome}"?`, [
    { text: "Cancelar" },
    { text: "Excluir", style: "destructive", onPress: async () => { try { await apiDelete(token, "turmas", t.id); load(); } catch (e) { Alert.alert("Erro", e.message); } } },
  ]);

  const filtered = turmas.filter(t => t.nome?.toLowerCase().includes(search.toLowerCase()) || t.instituicao?.toLowerCase().includes(search.toLowerCase()));

  const Picker = ({ label, options, value, onChange }) => (
    <View style={S.fieldBlock}>
      <Text style={S.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(options).map(([k, v]) => (
          <Pressable key={k} onPress={() => onChange(k)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: value === k ? C.primary : C.border, backgroundColor: value === k ? C.primaryLight : C.white }}>
            <Text style={{ fontSize: 13, color: value === k ? C.primary : C.muted, fontWeight: value === k ? "700" : "400" }}>{v}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[S.rowBetween, { marginBottom: 12 }]}>
          <Text style={S.title}>Turmas</Text>
          <Btn title="+ Nova" onPress={openNew} style={{ paddingHorizontal: 16, minHeight: 38 }} />
        </View>
        <TextInput style={S.searchBox} placeholder="Buscar turmas..." value={search} onChangeText={setSearch} placeholderTextColor={C.placeholder} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>🏫</Text><Text style={S.emptyTitle}>Nenhuma turma</Text><Text style={S.emptyText}>Crie sua primeira turma</Text></View>}
        renderItem={({ item: t }) => (
          <Pressable style={S.listItem} onPress={() => openEdit(t)}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={S.listItemTitle}>{t.nome}</Text>
                <Text style={S.listItemSub}>{t.ano_letivo} · {PERIODOS[t.periodo] || t.periodo} · {NIVEIS[t.nivel] || t.nivel}</Text>
                {t.instituicao ? <Text style={S.listItemSub}>{t.instituicao}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[S.badge, t.ativa !== false ? S.badgePrimary : S.badgeSecondary]}>
                  <Text style={t.ativa !== false ? S.badgeTextPrimary : S.badgeTextSecondary}>{t.ativa !== false ? "Ativa" : "Inativa"}</Text>
                </View>
                <Btn title="Excluir" variant="danger" onPress={() => del(t)} style={{ minHeight: 30, paddingHorizontal: 10 }} />
              </View>
            </View>
          </Pressable>
        )}
      />

      <FormModal visible={modalOpen} title={editing ? "Editar Turma" : "Nova Turma"} onClose={() => setModalOpen(false)} onSave={save} saving={saving}>
        <FieldInput label="Nome *" value={form.nome} onChangeText={v => setForm({ ...form, nome: v })} placeholder="Ex: 3º Ano A" />
        <Picker label="Ano Letivo" options={Object.fromEntries(ANOS.map(a => [a, a]))} value={form.ano_letivo} onChange={v => setForm({ ...form, ano_letivo: v })} />
        <Picker label="Período" options={PERIODOS} value={form.periodo} onChange={v => setForm({ ...form, periodo: v })} />
        <Picker label="Nível" options={NIVEIS} value={form.nivel} onChange={v => setForm({ ...form, nivel: v })} />
        <FieldInput label="Instituição" value={form.instituicao} onChangeText={v => setForm({ ...form, instituicao: v })} placeholder="Nome da escola" />
        <View style={S.fieldBlock}>
          <Text style={S.label}>Status</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["Ativa", true], ["Inativa", false]].map(([lbl, val]) => (
              <Pressable key={lbl} onPress={() => setForm({ ...form, ativa: val })}
                style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: form.ativa === val ? C.primary : C.border, backgroundColor: form.ativa === val ? C.primaryLight : C.white, alignItems: "center" }}>
                <Text style={{ color: form.ativa === val ? C.primary : C.muted, fontWeight: "700" }}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}

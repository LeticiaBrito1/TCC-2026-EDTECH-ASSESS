import React, { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, Modal, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiList } from "../api/client";
import Btn from "../components/Btn";

export default function RelatoriosScreen({ token }) {
  const [resultados, setResultados] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, av, al, t] = await Promise.all([
        apiList(token, "resultados"),
        apiList(token, "avaliacoes"),
        apiList(token, "alunos"),
        apiList(token, "turmas"),
      ]);
      setResultados(Array.isArray(r) ? r : []);
      setAvaliacoes(Array.isArray(av) ? av : []);
      setAlunos(Array.isArray(al) ? al : []);
      setTurmas(Array.isArray(t) ? t : []);
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const getAvaliacao = (id) => avaliacoes.find(a => a.id === id);
  const getAluno = (id) => alunos.find(a => a.id === id);
  const getTurma = (id) => turmas.find(t => t.id === id);

  const avgNota = resultados.length > 0
    ? (resultados.reduce((s, r) => s + (Number(r.nota) || 0), 0) / resultados.length).toFixed(1)
    : "—";

  const byAvaliacao = avaliacoes.map(av => {
    const ress = resultados.filter(r => r.avaliacao_id === av.id);
    if (!ress.length) return null;
    const avg = (ress.reduce((s, r) => s + (Number(r.nota) || 0), 0) / ress.length).toFixed(1);
    return { av, ress, avg };
  }).filter(Boolean);

  const notaColor = (n) => Number(n) >= 7 ? C.success : Number(n) >= 5 ? C.warning : C.danger;

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <FlatList
        data={byAvaliacao}
        keyExtractor={i => i.av.id}
        contentContainerStyle={[S.content, { paddingTop: 20 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        ListHeaderComponent={
          <>
            <Text style={[S.title, { marginBottom: 16 }]}>Relatórios</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <View style={[S.statCard, { flex: 1 }]}>
                <Text style={S.statNumber}>{resultados.length}</Text>
                <Text style={S.statLabel}>Total de correções</Text>
              </View>
              <View style={[S.statCard, { flex: 1 }]}>
                <Text style={[S.statNumber, { color: notaColor(avgNota) }]}>{avgNota}</Text>
                <Text style={S.statLabel}>Média geral</Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={<View style={S.emptyBox}><Text style={S.emptyIcon}>📊</Text><Text style={S.emptyTitle}>Sem correções</Text><Text style={S.emptyText}>Corrija avaliações para ver relatórios</Text></View>}
        renderItem={({ item: { av, ress, avg } }) => (
          <Pressable style={S.card} onPress={() => { setSelected({ av, ress }); setDetailOpen(true); }}>
            <View style={S.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={S.listItemTitle}>{av.titulo}</Text>
                <Text style={S.listItemSub}>{ress.length} aluno(s) corrigido(s) · {getTurma(av.turma_id)?.nome || "Sem turma"}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: notaColor(avg) }}>{avg}</Text>
            </View>
            <View style={{ marginTop: 10, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, (Number(avg) / (av.total_pontos || 10)) * 100)}%`, height: 6, backgroundColor: notaColor(avg), borderRadius: 3 }} />
            </View>
          </Pressable>
        )}
      />

      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <SafeAreaView style={S.screen}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[S.title, { flex: 1 }]} numberOfLines={1}>{selected?.av?.titulo}</Text>
            <Btn title="Fechar" variant="secondary" onPress={() => setDetailOpen(false)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
          </View>
          <ScrollView contentContainerStyle={S.content}>
            {selected?.ress?.map(r => {
              const aluno = getAluno(r.aluno_id);
              return (
                <View key={r.id} style={S.card}>
                  <View style={S.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={S.listItemTitle}>{aluno?.nome || "Aluno"}</Text>
                      <Text style={S.listItemSub}>{r.total_acertos}/{r.total_questoes} acertos · {r.percentual_acerto}%</Text>
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: notaColor(r.nota) }}>{r.nota}</Text>
                  </View>
                  {r.respostas?.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {r.respostas.map((resp, idx) => (
                        <View key={idx} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: resp.correta ? C.successBg : C.dangerBg }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: resp.correta ? C.success : C.danger }}>{resp.resposta || "—"}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

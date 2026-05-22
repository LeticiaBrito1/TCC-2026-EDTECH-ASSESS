import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { S, C } from "../components/AppStyles";
import { apiList } from "../api/client";

export default function DashboardScreen({ token, user }) {
  const navigation = useNavigation();
  const [data, setData] = useState({ turmas: [], alunos: [], resultados: [], avaliacoes: [] });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, a, r, av] = await Promise.all([
        apiList(token, "turmas"),
        apiList(token, "alunos"),
        apiList(token, "resultados"),
        apiList(token, "avaliacoes"),
      ]);
      setData({
        turmas: Array.isArray(t) ? t : [],
        alunos: Array.isArray(a) ? a : [],
        resultados: Array.isArray(r) ? r : [],
        avaliacoes: Array.isArray(av) ? av : [],
      });
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const avgScore = data.resultados.length > 0
    ? (data.resultados.reduce((s, r) => s + (Number(r.nota) || 0), 0) / data.resultados.length).toFixed(1)
    : "—";

  // Apenas 3 cards — Turmas e Relatórios estão no tab "Mais", Alunos é tab direto
  const stats = [
    { label: "Turmas",    value: data.turmas.length,    tab: "Mais",   icon: "school-outline" },
    { label: "Alunos",    value: data.alunos.length,    tab: "Alunos", icon: "people-outline" },
    { label: "Relatórios",value: data.resultados.length,tab: "Mais",   icon: "bar-chart-outline" },
  ];

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[S.content, { paddingTop: 20 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
      >
        {/* Saudação */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: C.dark }}>
            Olá, {user?.full_name?.split(" ")[0] || "Professor"} 👋
          </Text>
          <Text style={S.muted}>Bem-vindo ao EdTech Assess</Text>
        </View>

        {/* 3 cards grandes */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          {stats.map((s) => (
            <Pressable
              key={s.label}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: C.white,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.border,
                padding: 16,
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
              onPress={() => navigation.navigate(s.tab)}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#f0fdfb", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={s.icon} size={26} color={C.primary} />
              </View>
              <Text style={{ fontSize: 30, fontWeight: "900", color: C.primary }}>{s.value}</Text>
              <Text style={{ fontSize: 13, color: C.muted, fontWeight: "600", textAlign: "center" }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Desempenho geral */}
        {data.resultados.length > 0 && (
          <View style={[S.card, { marginBottom: 12 }]}>
            <Text style={S.sectionTitle}>Desempenho Geral</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 36, fontWeight: "900", color: C.primary }}>{avgScore}</Text>
                <Text style={S.muted}>Média de notas</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 36, fontWeight: "900", color: C.primary }}>{data.resultados.length}</Text>
                <Text style={S.muted}>Correções feitas</Text>
              </View>
            </View>
          </View>
        )}

        {/* Últimas avaliações */}
        {data.avaliacoes.length > 0 && (
          <Pressable style={S.card} onPress={() => navigation.navigate("Avaliacoes")}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={S.sectionTitle}>Últimas Avaliações</Text>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </View>
            {data.avaliacoes.slice(0, 3).map((av, idx) => (
              <View key={av.id} style={{
                paddingVertical: 10,
                borderBottomWidth: idx < 2 ? 1 : 0,
                borderBottomColor: C.border,
              }}>
                <Text style={S.listItemTitle}>{av.titulo}</Text>
                <Text style={S.listItemSub}>{av.questoes_ids?.length || 0} questões · {av.total_pontos || 0} pts</Text>
              </View>
            ))}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import React from "react";
import { View, Text, ScrollView, Image, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import Btn from "../components/Btn";

const FEATURES = [
  "Turmas ilimitadas",
  "Alunos ilimitados",
  "Questões ilimitadas",
  "Geração com IA (Groq/Llama)",
  "Correção por OCR",
  "Exportação PDF ilimitada",
  "Relatórios completos",
  "Integração com LMS (Moodle)",
];

export default function PagamentoScreen() {
  const handleAssinar = () => Alert.alert(
    "Assinar Plano Fundador",
    "Você será redirecionado para a página de pagamento.",
    [{ text: "Cancelar" }, { text: "Continuar", onPress: () => {} }]
  );

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={[S.content, { paddingTop: 20 }]}>
        <View style={{ marginBottom: 20 }}>
          <Text style={[S.title, { fontSize: 24 }]}>Plano e Pagamentos</Text>
          <Text style={{ color: C.primary, fontWeight: "600", marginTop: 4 }}>
            Assine o Plano Fundador e tenha acesso completo
          </Text>
        </View>

        <View style={[S.card, { borderColor: C.primary, borderWidth: 2, alignItems: "center" }]}>
          <View style={[S.badge, S.badgePrimary, { marginBottom: 12 }]}>
            <Text style={S.badgeTextPrimary}>Oferta especial</Text>
          </View>

          <Image source={require("../../assets/logoEDTECH.png")} style={{ width: 64, height: 64, marginBottom: 12 }} resizeMode="contain" />

          <Text style={{ fontSize: 22, fontWeight: "900", color: C.dark }}>Plano Fundador</Text>

          <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 36, fontWeight: "900", color: C.primary }}>R$ 48,90</Text>
            <Text style={[S.muted, { marginBottom: 4, marginLeft: 4 }]}>/mês</Text>
          </View>

          <View style={{ width: "100%", gap: 10, marginBottom: 20 }}>
            {FEATURES.map(f => (
              <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.primary, fontSize: 12, fontWeight: "900" }}>✓</Text>
                </View>
                <Text style={S.body}>{f}</Text>
              </View>
            ))}
          </View>

          <Btn title="Assinar agora" onPress={handleAssinar} style={{ width: "100%" }} />
        </View>

        <View style={[S.card, { alignItems: "center" }]}>
          <Text style={S.muted}>Pagamento 100% seguro</Text>
          <Text style={[S.muted, { marginTop: 4 }]}>Cancele quando quiser · Suporte incluso</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

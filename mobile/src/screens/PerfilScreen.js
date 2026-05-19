import React, { useState } from "react";
import { View, Text, ScrollView, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { S, C } from "../components/AppStyles";
import { apiUpdateProfile, apiChangePassword } from "../api/client";
import Btn from "../components/Btn";
import FieldInput from "../components/FieldInput";

export default function PerfilScreen({ token, user, onLogout, onUserUpdate }) {
  const [profileForm, setProfileForm] = useState({ full_name: user?.full_name || "", email: user?.email || "" });
  const [pwForm, setPwForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    setSavingProfile(true);
    try {
      const updated = await apiUpdateProfile(token, profileForm);
      if (onUserUpdate && updated) onUserUpdate(updated);
      Alert.alert("Sucesso", "Perfil atualizado.");
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSavingProfile(false); }
  };

  const savePassword = async () => {
    if (!pwForm.senha_atual || !pwForm.nova_senha) { Alert.alert("Atenção", "Preencha todos os campos."); return; }
    if (pwForm.nova_senha !== pwForm.confirmar) { Alert.alert("Atenção", "As senhas não coincidem."); return; }
    if (pwForm.nova_senha.length < 6) { Alert.alert("Atenção", "Senha deve ter ao menos 6 caracteres."); return; }
    setSavingPw(true);
    try {
      await apiChangePassword(token, { senha_atual: pwForm.senha_atual, nova_senha: pwForm.nova_senha });
      Alert.alert("Sucesso", "Senha alterada.");
      setPwForm({ senha_atual: "", nova_senha: "", confirmar: "" });
    } catch (e) { Alert.alert("Erro", e.message); }
    finally { setSavingPw(false); }
  };

  const confirmLogout = () => Alert.alert("Sair", "Deseja sair da conta?", [
    { text: "Cancelar" },
    { text: "Sair", style: "destructive", onPress: onLogout },
  ]);

  return (
    <SafeAreaView style={S.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={[S.content, { paddingTop: 20 }]}>
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 32, fontWeight: "900", color: C.primary }}>
              {(user?.full_name || user?.email || "?")[0].toUpperCase()}
            </Text>
          </View>
          <Text style={S.title}>{user?.full_name || "Usuário"}</Text>
          <Text style={S.muted}>{user?.email}</Text>
        </View>

        <View style={S.card}>
          <Text style={S.sectionTitle}>Dados Pessoais</Text>
          <FieldInput label="Nome completo" value={profileForm.full_name} onChangeText={v => setProfileForm({ ...profileForm, full_name: v })} />
          <FieldInput label="Email" value={profileForm.email} onChangeText={v => setProfileForm({ ...profileForm, email: v })} keyboardType="email-address" autoCapitalize="none" />
          <Btn title="Salvar Perfil" onPress={saveProfile} loading={savingProfile} />
        </View>

        <View style={S.card}>
          <Text style={S.sectionTitle}>Alterar Senha</Text>
          <FieldInput label="Senha atual" value={pwForm.senha_atual} onChangeText={v => setPwForm({ ...pwForm, senha_atual: v })} secureTextEntry />
          <FieldInput label="Nova senha" value={pwForm.nova_senha} onChangeText={v => setPwForm({ ...pwForm, nova_senha: v })} secureTextEntry />
          <FieldInput label="Confirmar nova senha" value={pwForm.confirmar} onChangeText={v => setPwForm({ ...pwForm, confirmar: v })} secureTextEntry />
          <Btn title="Alterar Senha" onPress={savePassword} loading={savingPw} />
        </View>

        <View style={[S.card, { alignItems: "center", gap: 12 }]}>
          <Image source={require("../../assets/logoEDTECH.png")} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <Text style={[S.muted, { textAlign: "center" }]}>EdTech Assess v1.0{"\n"}Plataforma de avaliações educacionais com IA</Text>
        </View>

        <Btn title="Sair da conta" variant="danger" onPress={confirmLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}

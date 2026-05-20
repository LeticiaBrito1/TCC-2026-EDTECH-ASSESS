import React from "react";
import { Modal, View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { S } from "./AppStyles";
import Btn from "./Btn";

export default function FormModal({ visible, title, onClose, onSave, saving, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={S.modalOverlay} onPress={onClose}>
          <Pressable onPress={() => {}} style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{title}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Btn title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
              <Btn title="Salvar" onPress={onSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

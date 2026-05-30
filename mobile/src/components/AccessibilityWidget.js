import React, { createContext, useContext, useState } from "react";
import {
  View, Text, Pressable, Modal, Switch, StyleSheet, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const AccessibilityContext = createContext({
  largeText: false,
  highContrast: false,
  toggle: () => {},
  fontSize: (base) => base,
  colors: {},
});

const BASE_COLORS = {
  primary: "#0f766e",
  bg: "#f3f4f6",
  white: "#fff",
  dark: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  danger: "#b91c1c",
};

const HC_COLORS = {
  primary: "#065f46",
  bg: "#ffffff",
  white: "#ffffff",
  dark: "#000000",
  muted: "#1e293b",
  border: "#000000",
  danger: "#7f1d1d",
};

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState({ largeText: false, highContrast: false });

  const toggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  const fontSize = (base) => settings.largeText ? Math.round(base * 1.2) : base;
  const colors = settings.highContrast ? HC_COLORS : BASE_COLORS;

  return (
    <AccessibilityContext.Provider value={{ ...settings, toggle, fontSize, colors }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);

const OPTIONS = [
  {
    key: "largeText",
    label: "Texto grande",
    desc: "Aumenta o tamanho das fontes",
    icon: "text-outline",
  },
  {
    key: "highContrast",
    label: "Alto contraste",
    desc: "Aumenta o contraste das cores",
    icon: "contrast-outline",
  },
];

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const { largeText, highContrast, toggle } = useAccessibility();
  const values = { largeText, highContrast };
  const activeCount = Object.values(values).filter(Boolean).length;

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
      >
        <Pressable
          style={S.overlay}
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar painel de acessibilidade"
        >
          <Pressable style={S.panel} onPress={() => {}} accessible={false}>
            <View style={S.panelHeader}>
              <Text style={S.panelTitle}>Acessibilidade</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityLabel="Fechar"
                accessibilityRole="button"
                style={S.closeBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView>
              {OPTIONS.map(({ key, label, desc, icon }) => (
                <View
                  key={key}
                  style={S.optionRow}
                  accessible
                  accessibilityRole="switch"
                  accessibilityLabel={label}
                  accessibilityHint={desc}
                  accessibilityState={{ checked: values[key] }}
                >
                  <Ionicons name={icon} size={20} color="#0f766e" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.optLabel}>{label}</Text>
                    <Text style={S.optDesc}>{desc}</Text>
                  </View>
                  <Switch
                    value={values[key]}
                    onValueChange={() => toggle(key)}
                    trackColor={{ false: "#e2e8f0", true: "#0f766e" }}
                    thumbColor="#fff"
                    accessibilityLabel={label}
                  />
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable
        style={[S.fab, activeCount > 0 && S.fabActive]}
        onPress={() => setOpen(true)}
        accessibilityLabel={
          open
            ? "Fechar configurações de acessibilidade"
            : "Abrir configurações de acessibilidade"
        }
        accessibilityRole="button"
        accessibilityHint="Abre painel com opções de texto grande e alto contraste"
      >
        <Ionicons
          name="settings-outline"
          size={22}
          color={activeCount > 0 ? "#fff" : "#0f766e"}
        />
        {activeCount > 0 && (
          <View style={S.badge} accessibilityElementsHidden>
            <Text style={S.badgeText}>{activeCount}</Text>
          </View>
        )}
      </Pressable>
    </>
  );
}

const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    paddingBottom: 90,
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  optLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  optDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  fabActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "900",
  },
});

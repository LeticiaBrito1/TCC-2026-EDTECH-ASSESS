import { StyleSheet } from "react-native";

export const C = {
  primary: "#0f766e",
  primaryLight: "#ecfeff",
  primaryBorder: "#99f6e4",
  bg: "#f3f4f6",
  white: "#fff",
  dark: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  placeholder: "#94a3b8",
  border: "#e2e8f0",
  borderInput: "#cbd5e1",
  inputBg: "#f8fafc",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  successBg: "#f0fdf4",
  success: "#16a34a",
  warning: "#d97706",
  warningBg: "#fffbeb",
  secondary: "#e2e8f0",
  radius: 14,
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: C.white, borderRadius: C.radius, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  title: { fontSize: 20, fontWeight: "800", color: C.dark },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: C.dark, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 4 },
  body: { fontSize: 14, color: C.text },
  muted: { fontSize: 12, color: C.muted },
  errorText: { fontSize: 13, color: C.danger, fontWeight: "700" },

  input: { backgroundColor: C.inputBg, borderRadius: 10, borderWidth: 1, borderColor: C.borderInput, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.dark },
  fieldBlock: { marginBottom: 14 },

  btn: { borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: C.primary },
  btnSecondary: { backgroundColor: C.secondary },
  btnDanger: { backgroundColor: C.danger },
  btnGhost: { backgroundColor: C.primaryLight },
  btnTextLight: { fontSize: 14, fontWeight: "800", color: C.white },
  btnTextDark: { fontSize: 14, fontWeight: "800", color: C.dark },
  btnTextPrimary: { fontSize: 14, fontWeight: "800", color: C.primary },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  badgePrimary: { backgroundColor: C.primaryLight },
  badgeSecondary: { backgroundColor: C.secondary },
  badgeDanger: { backgroundColor: C.dangerBg },
  badgeTextPrimary: { fontSize: 11, fontWeight: "700", color: C.primary },
  badgeTextSecondary: { fontSize: 11, fontWeight: "700", color: C.muted },
  badgeTextDanger: { fontSize: 11, fontWeight: "700", color: C.danger },

  separator: { height: 1, backgroundColor: C.border, marginVertical: 10 },

  emptyBox: { alignItems: "center", padding: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: C.dark },
  emptyText: { fontSize: 13, color: C.muted, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.dark, marginBottom: 16 },
  modalHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },

  listItem: { backgroundColor: C.white, borderRadius: C.radius, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  listItemTitle: { fontSize: 15, fontWeight: "700", color: C.dark },
  listItemSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  searchBox: { backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.dark, marginBottom: 12 },

  statCard: { flex: 1, backgroundColor: C.white, borderRadius: C.radius, borderWidth: 1, borderColor: C.border, padding: 16, alignItems: "center", margin: 4 },
  statNumber: { fontSize: 28, fontWeight: "900", color: C.primary },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2, textAlign: "center" },
});

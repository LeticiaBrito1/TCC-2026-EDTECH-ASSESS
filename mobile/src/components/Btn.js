import React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { S, C } from "./AppStyles";

export default function Btn({ title, onPress, variant = "primary", disabled = false, loading = false, style }) {
  const bg = variant === "secondary" ? S.btnSecondary
    : variant === "danger" ? S.btnDanger
    : variant === "ghost" ? S.btnGhost
    : S.btnPrimary;
  const tc = (variant === "secondary" || variant === "ghost") ? S.btnTextDark : S.btnTextLight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [S.btn, bg, (pressed || disabled || loading) && { opacity: 0.7 }, style]}
    >
      {loading
        ? <ActivityIndicator color={variant === "secondary" ? C.dark : C.white} size="small" />
        : <Text style={tc}>{title}</Text>}
    </Pressable>
  );
}

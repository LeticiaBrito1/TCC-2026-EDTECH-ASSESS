import React from "react";
import { View, Text, TextInput } from "react-native";
import { S } from "./AppStyles";

export default function FieldInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = "sentences", multiline, numberOfLines, maxLength }) {
  return (
    <View style={S.fieldBlock}>
      {label ? <Text style={S.label}>{label}</Text> : null}
      <TextInput
        style={[S.input, multiline && { height: numberOfLines ? numberOfLines * 38 : 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
      />
    </View>
  );
}

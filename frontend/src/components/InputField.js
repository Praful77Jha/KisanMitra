import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import theme from '../theme';

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  icon,
  style,
  error,
}) {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusMedium,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  inputWrapperError: {
    borderColor: theme.colors.error,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.xs,
    marginTop: theme.spacing.xs,
  },
});

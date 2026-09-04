import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

export default function CategoryChip({ label, icon, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={active ? theme.colors.textOnPrimary : theme.colors.primary}
          style={styles.icon}
        />
      ) : null}
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusRound,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  icon: {
    marginRight: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
  },
  labelActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});

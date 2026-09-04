import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme';

export default function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.xxs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.spacing.radiusMedium - 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  label: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
  },
  labelActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});

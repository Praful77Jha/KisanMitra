import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

export default function QuickAction({ icon, label, color, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={[styles.iconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color={theme.colors.textOnPrimary} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    width: '20%',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: theme.typography.fontWeights.medium,
  },
});

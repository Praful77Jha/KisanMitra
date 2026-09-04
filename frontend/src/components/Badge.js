import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme';

const TYPE_COLORS = {
  success: { bg: theme.colors.badgeSuccess, fg: theme.colors.success },
  warning: { bg: theme.colors.badgeWarning, fg: theme.colors.warning },
  error: { bg: theme.colors.badgeError, fg: theme.colors.error },
  info: { bg: theme.colors.badgeInfo, fg: theme.colors.info },
};

export default function Badge({ label, type = 'success', icon, onPress }) {
  const palette = TYPE_COLORS[type] || TYPE_COLORS.success;

  const content = (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Text style={[styles.icon, { color: palette.fg }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs + 2,
    borderRadius: theme.spacing.radiusRound,
  },
  icon: {
    fontSize: theme.typography.fontSizes.xs,
    marginRight: theme.spacing.xxs,
  },
  label: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

export default function Header({ title, showBack = false, onBack, rightIcon, onRightPress }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.md }]}>
      {showBack ? (
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {rightIcon ? (
        <Pressable onPress={onRightPress} style={styles.rightButton} hitSlop={8}>
          <Ionicons name={rightIcon} size={22} color={theme.colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  backButton: {
    width: 32,
  },
  rightButton: {
    width: 32,
    alignItems: 'flex-end',
  },
  spacer: {
    width: 32,
  },
});

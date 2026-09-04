import React from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useTranslation } from '../i18n';

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  onFilterPress,
  onSubmitEditing,
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.search');
  return (
    <View style={styles.row}>
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={resolvedPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
        />
      </View>
      {onFilterPress ? (
        <Pressable style={styles.filterButton} onPress={onFilterPress} hitSlop={6}>
          <Ionicons name="options-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusMedium,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  filterButton: {
    marginLeft: theme.spacing.sm,
    width: 46,
    height: 46,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

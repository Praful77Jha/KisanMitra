import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../theme';
import { useTranslation } from '../i18n';

export default function PlaceholderScreen({ title, description }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <Text style={styles.hint}>{t('common.underConstruction')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.lg,
  },
});

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../theme';
import { useTranslation } from '../i18n';

export default function SplashScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.body}>
        <View style={styles.brandRow}>
          <Ionicons name="leaf" size={34} color={theme.colors.textOnPrimary} />
          <Text style={styles.brandName}>KisanMitra</Text>
        </View>

        <View style={[styles.illustration, { width: width * 0.72 }]}>
          <View style={styles.sun} />
          <MaterialCommunityIcons
            name="tractor-variant"
            size={110}
            color={theme.colors.primaryLight}
          />
          <View style={styles.ground}>
            <MaterialCommunityIcons
              name="sprout"
              size={26}
              color={theme.colors.primaryLight}
              style={styles.sprout}
            />
          </View>
          <Text style={styles.illustrationLabel}>{t('splash.illustrationLabel')}</Text>
        </View>

        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('splash.footerText')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  brandName: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textOnPrimary,
    marginLeft: theme.spacing.sm,
  },
  illustration: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.spacing.radiusLarge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sun: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.secondary,
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: theme.spacing.sm,
  },
  sprout: {
    marginLeft: -theme.spacing.lg,
  },
  illustrationLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.medium,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    opacity: 0.95,
  },
  tagline: {
    fontSize: theme.typography.fontSizes.lg,
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
    marginTop: theme.spacing.xl,
    textAlign: 'center',
    opacity: 0.95,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  footerText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textOnPrimary,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.9,
  },
});

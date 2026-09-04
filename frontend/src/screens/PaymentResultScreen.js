import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function PaymentResultScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, state, paymentRef } = route.params || {};
  const paid = state === 'paid';

  const goToOrder = () => navigation.replace('OrderDetails', { orderId });
  const goToOrders = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] });
  const tryAgain = () => navigation.replace('Payment', { orderId });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, paid ? styles.iconSuccess : styles.iconFailed]}>
            <Ionicons
              name={paid ? 'checkmark' : 'close'}
              size={40}
              color={theme.colors.textOnPrimary}
            />
          </View>
          <Text style={styles.title}>{paid ? t('paymentResult.paidTitle') : t('paymentResult.failedTitle')}</Text>
          <Text style={styles.subtitle}>
            {paid ? t('paymentResult.paidSubtitle') : t('paymentResult.failedSubtitle')}
          </Text>
          {paid && paymentRef ? (
            <Text style={styles.ref}>
              {`${t('paymentResult.reference')}: ${paymentRef}`}
            </Text>
          ) : null}
        </View>

        {paid ? (
          <View style={styles.noticeRow}>
            <Ionicons name="flask-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.noticeText}>{t('paymentResult.devNotice')}</Text>
          </View>
        ) : null}

        {paid ? (
          <PrimaryButton title={t('paymentResult.viewOrder')} onPress={goToOrder} style={styles.actionButton} />
        ) : (
          <>
            <PrimaryButton title={t('paymentResult.tryAgain')} onPress={tryAgain} style={styles.actionButton} />
            <PrimaryButton
              title={t('paymentResult.backToOrders')}
              variant="outline"
              onPress={goToOrders}
              style={styles.secondaryButton}
            />
          </>
        )}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconSuccess: {
    backgroundColor: theme.colors.success,
  },
  iconFailed: {
    backgroundColor: theme.colors.error,
  },
  title: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  ref: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
    marginTop: theme.spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  actionButton: {
    marginTop: theme.spacing.sm,
  },
  secondaryButton: {
    marginTop: theme.spacing.md,
  },
  footerSpacer: {
    height: theme.spacing.xl,
  },
});

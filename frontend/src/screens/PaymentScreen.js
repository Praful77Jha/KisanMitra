import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { getPayment, confirmPayment, cancelPayment } from '../services/paymentService';
import { formatCurrency } from '../utils/formatting';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function PaymentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const orderId = route.params?.orderId;

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPayment(orderId)
      .then((data) => {
        if (!cancelled) {
          setPayment(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('payment.couldNotLoad'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('payment.title')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={styles.screen}>
        <Header title={t('payment.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState icon="card-outline" title={t('payment.couldNotLoad')} message={error} />
      </View>
    );
  }

  const goBackToOrders = (replace = 0) => {
    const go = () => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] });
    if (replace === 1) go();
    else navigation.goBack();
  };

  const handlePay = async () => {
    setProcessing(true);
    setActionError('');
    try {
      await confirmPayment(orderId);
    } catch (_) {
      // The backend records a 'failed' state; re-fetch to show the true result.
    }
    let state = 'failed';
    let paymentRef = null;
    try {
      const p = await getPayment(orderId);
      state = p.state || 'failed';
      paymentRef = p.paymentRef || null;
    } catch (_) {
      // keep failed
    }
    setProcessing(false);
    navigation.replace('PaymentResult', { orderId, state, paymentRef });
  };

  const handleCancel = async () => {
    setCancelling(true);
    setActionError('');
    try {
      await cancelPayment(orderId);
      navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] });
    } catch (e) {
      setActionError(e.message || t('payment.couldNotCancel'));
      setCancelling(false);
    }
  };

  const paidAlready = payment.state === 'paid';

  return (
    <View style={styles.screen}>
      <Header title={t('payment.title')} showBack onBack={goBackToOrders} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{t('payment.payForOrder')}</Text>

        <View style={styles.card}>
          <InfoRow label={t('payment.orderId')} value={orderId} />
          <View style={styles.divider} />
          <InfoRow label={t('payment.paymentMethod')} value={payment.paymentMethod || t('payment.methodBank')} />
          <InfoRow label={t('payment.amount')} value={formatCurrency(payment.amount)} type="net" />
        </View>

        {payment.devOnly ? (
          <View style={styles.noticeRow}>
            <Ionicons name="flask-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.noticeText}>{t('payment.devNotice')}</Text>
          </View>
        ) : null}

        {paidAlready ? (
          <>
            <EmptyState
              icon="checkmark-circle-outline"
              title={t('payment.alreadyPaid')}
            />
            <PrimaryButton
              title={t('paymentResult.viewOrder')}
              onPress={() => navigation.replace('OrderDetails', { orderId })}
              style={styles.actionButton}
            />
          </>
        ) : (
          <>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            <PrimaryButton
              title={processing ? t('payment.processing') : t('payment.payNow')}
              onPress={handlePay}
              disabled={processing || cancelling}
              style={styles.actionButton}
            />
            <PrimaryButton
              title={cancelling ? t('payment.cancelling') : t('payment.cancel')}
              variant="outline"
              onPress={handleCancel}
              disabled={processing || cancelling}
              style={styles.cancelButton}
            />
          </>
        )}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, type = 'neutral' }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, type === 'net' && styles.infoValueNet]}>{value}</Text>
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
    paddingTop: theme.spacing.lg,
  },
  heading: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  infoValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  infoValueNet: {
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.bold,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
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
  cancelButton: {
    marginTop: theme.spacing.md,
  },
  actionError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  footerSpacer: {
    height: theme.spacing.xl,
  },
});

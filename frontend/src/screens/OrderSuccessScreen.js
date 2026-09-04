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
import { fetchOrderById } from '../services/productService';
import { formatCurrency, formatQuantity, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function OrderSuccessScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const orderId = route.params?.orderId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchOrderById(orderId)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadOrder'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [orderId]);

  const goToOrders = () => {
    navigation.replace('Tabs', { screen: 'Orders' });
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderSuccess.title')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderSuccess.title')} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadOrder')}
          message={error}
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderSuccess.title')} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.orderNotFound')}
          message={t('emptyStates.orderNotFoundHint')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('orderSuccess.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={theme.colors.textOnPrimary} />
          </View>
          <Text style={styles.successTitle}>{t('orderSuccess.orderPlacedSuccessfully')}</Text>
          <Text style={styles.successSubtitle}>
            {t('orderSuccess.orderPlacedSubtitle')}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{t('orderSuccess.orderId')}</Text>
            <Badge
              label={order.status}
              type={order.status === 'Delivered' ? 'success' : 'info'}
            />
          </View>
          <Text style={styles.orderId}>{order.id}</Text>
          <View style={styles.divider} />
          <InfoRow label={t('orderSuccess.product')} value={order.productName} />
          <InfoRow label={t('orderSuccess.quantity')} value={formatQuantity(order.quantity, order.unit)} />
          <InfoRow label={t('orderSuccess.seller')} value={order.sellerName} />
          <InfoRow label={t('orderSuccess.orderDate')} value={formatDate(order.orderDate)} />
          <InfoRow label={t('orderSuccess.orderTotal')} value={formatCurrency(order.totalAmount)} type="net" />
        </View>

        <Text style={styles.statusHint}>
          {`${t('orderSuccess.currentStatus')}: ${order.status} · ${t('orderSuccess.orderStages')}: ${order.timeline.length}`}
        </Text>

        <PrimaryButton title={t('orderSuccess.viewOrder')} onPress={goToOrders} style={styles.viewButton} />
        <PrimaryButton
          title={t('orderSuccess.backToHome')}
          variant="outline"
          onPress={() => navigation.popToTop()}
          style={styles.homeButton}
        />
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, type = 'neutral' }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          type === 'net' && styles.infoValueNet,
        ]}
      >
        {value}
      </Text>
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
    paddingTop: theme.spacing.xl,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  orderId: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.md,
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
  statusHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  viewButton: {
    marginTop: theme.spacing.sm,
  },
  homeButton: {
    marginTop: theme.spacing.md,
  },
  footerSpacer: {
    height: theme.spacing.xl,
  },
});

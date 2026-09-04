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
import { fetchRequirementById, fetchOffersForRequirement, getPlatformFee, createOrder } from '../services/productService';
import { formatCurrency, formatQuantity } from '../utils/formatting';
import { totalDeliveredCost } from '../utils/calculation';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function ConfirmOrderScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { requirementId, offerId } = route.params || {};

  const [requirement, setRequirement] = useState(null);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchRequirementById(requirementId),
      fetchOffersForRequirement(requirementId),
    ])
      .then(([req, offs]) => {
        if (!cancelled) {
          setRequirement(req);
          setOffer(offs.find((o) => o.id === offerId) || null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadOrderDetails'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [requirementId, offerId]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('confirmOrder.title')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('confirmOrder.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadOrderDetails')}
          message={error}
        />
      </View>
    );
  }

  if (!requirement || !offer) {
    return (
      <View style={styles.screen}>
        <Header title={t('confirmOrder.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.offerUnavailable')}
          message={t('emptyStates.offerUnavailableHint')}
        />
      </View>
    );
  }

  const deliveredCostPerQuintal = totalDeliveredCost(
    offer.offeredPricePerQuintal,
    offer.transportCostPerQuintal,
    offer.otherCostsPerQuintal
  );
  const platformFee = getPlatformFee();
  const deliveredTotal = deliveredCostPerQuintal * offer.quantity;
  const orderTotal = deliveredTotal + platformFee;

  const handleConfirm = async () => {
    setPlacing(true);
    setSubmitError('');
    try {
      const order = await createOrder({ requirementId, offerId });
      navigation.replace('Payment', { orderId: order.id });
    } catch (e) {
      setSubmitError(e.message || t('errors.couldNotPlaceOrder'));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header title={t('confirmOrder.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>{t('confirmOrder.reviewOrder')}</Text>
        <Text style={styles.subheading}>
          {t('confirmOrder.confirmDetails')}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('confirmOrder.requirement')}</Text>
          <View style={styles.card}>
            <InfoRow label={t('confirmOrder.cropProduct')} value={requirement.cropName} />
            <InfoRow label={t('confirmOrder.quantity')} value={formatQuantity(requirement.quantity, requirement.unit)} />
            <InfoRow label={t('confirmOrder.grade')} value={requirement.grade} />
            <InfoRow label={t('confirmOrder.deliveryLocation')} value={requirement.location} />
            <InfoRow
              label={t('confirmOrder.maxExpectedPrice')}
              value={`${formatCurrency(requirement.maxPricePerQuintal)} ${t('common.qtl')}`}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('confirmOrder.selectedSeller')}</Text>
          <View style={styles.card}>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerAvatarText}>
                  {offer.sellerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{offer.sellerName}</Text>
                  {offer.verified ? (
                    <View style={styles.verifiedWrap}>
                      <Ionicons name="shield-checkmark" size={13} color={theme.colors.success} />
                      <Text style={styles.verifiedText}>{t('product.verified')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={13} color={theme.colors.secondary} />
                  <Text style={styles.ratingText}>{offer.sellerRating}</Text>
                  <Text style={styles.distanceText}>{offer.distanceKm} {t('confirmOrder.kmAway')}</Text>
                </View>
              </View>
            </View>
            <InfoRow label={t('confirmOrder.deliveryLocation')} value={requirement.location} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('confirmOrder.costSummary')}</Text>
          <View style={styles.card}>
            <InfoRow label={t('confirmOrder.offeredPrice')} value={`${formatCurrency(offer.offeredPricePerQuintal)} ${t('common.qtl')}`} />
            <InfoRow label={`${t('confirmOrder.quantity')} (${offer.unit})`} value={String(offer.quantity)} />
            <InfoRow label={t('confirmOrder.transport')} value={formatCurrency(offer.transportCostPerQuintal * offer.quantity)} />
            <InfoRow label={t('confirmOrder.otherCosts')} value={formatCurrency(offer.otherCostsPerQuintal * offer.quantity)} />
            <InfoRow label={t('confirmOrder.totalDeliveredCost')} type="net" value={formatCurrency(deliveredTotal)} />
            <InfoRow label={t('confirmOrder.platformFee')} value={formatCurrency(platformFee)} />
            <View style={styles.divider} />
            <InfoRow label={t('confirmOrder.orderTotal')} type="net" value={formatCurrency(orderTotal)} />
          </View>
          <Text style={styles.costHint}>
            {formatCurrency(deliveredCostPerQuintal)} {t('confirmOrder.costPerUnitHint', { unit: offer.unit.toLowerCase() })}
          </Text>
        </View>

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <PrimaryButton
          title={placing ? t('confirmOrder.placing') : t('confirmOrder.confirmPlaceOrder')}
          onPress={handleConfirm}
          disabled={placing}
          style={styles.confirmButton}
        />
        <PrimaryButton
          title={t('common.cancel')}
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
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
    paddingTop: theme.spacing.lg,
  },
  heading: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  subheading: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
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
  costHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sellerName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  verifiedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.xs,
  },
  ratingText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  distanceText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xs,
  },
  confirmButton: {
    marginTop: theme.spacing.sm,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: theme.spacing.md,
  },
  footerSpacer: {
    height: theme.spacing.xl,
  },
});

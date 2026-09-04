import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchRequirementById, fetchOffersForRequirement } from '../services/productService';
import { formatCurrency, formatQuantity } from '../utils/formatting';
import { totalDeliveredCost } from '../utils/calculation';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

function dealScoreColor(score) {
  if (score >= 85) return theme.colors.success;
  if (score >= 70) return theme.colors.secondary;
  return theme.colors.warning;
}

export default function OffersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const requirementId = route.params?.requirementId;

  const [requirement, setRequirement] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchRequirementById(requirementId),
      fetchOffersForRequirement(requirementId),
    ])
      .then(([req, offs]) => {
        if (!cancelled) {
          setRequirement(req);
          setOffers(offs);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadOffers'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [requirementId]);

  const [shortlistedIds, setShortlistedIds] = useState(() => new Set());
  const [selectedOfferId, setSelectedOfferId] = useState(null);

  useEffect(() => {
    if (offers.length > 0 && shortlistedIds.size === 0) {
      setShortlistedIds(new Set(offers.filter((o) => o.shortlisted).map((o) => o.id)));
    }
  }, [offers]);

  const sortedOffers = [...offers].sort((a, b) => b.dealScore - a.dealScore);

  const toggleShortlist = (offerId) => {
    setShortlistedIds((current) => {
      const next = new Set(current);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });
  };

  const renderOffer = ({ item }) => {
    const shortlisted = shortlistedIds.has(item.id);
    const selected = selectedOfferId === item.id;
    const deliveredCost = totalDeliveredCost(
      item.offeredPricePerQuintal,
      item.transportCostPerQuintal,
      item.otherCostsPerQuintal
    );

    return (
      <Pressable
        onPress={() => setSelectedOfferId(item.id)}
        style={[styles.card, selected && styles.cardSelected]}
      >
        <View style={styles.cardTop}>
          <View style={styles.sellerBlock}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {item.sellerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {item.sellerName}
                </Text>
                {item.verified ? (
                  <Ionicons name="shield-checkmark" size={14} color={theme.colors.success} />
                ) : null}
              </View>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={theme.colors.secondary} />
                <Text style={styles.ratingText}>{item.sellerRating}</Text>
                <Text style={styles.distanceText}>{item.distanceKm} {t('offers.kmAway')}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => toggleShortlist(item.id)}
            hitSlop={8}
            style={styles.shortlistButton}
          >
            <Ionicons
              name={shortlisted ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={shortlisted ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceValue}>{formatCurrency(item.offeredPricePerQuintal)}</Text>
            <Text style={styles.priceUnit}>{t('product.quintal')}</Text>
          </View>
          <View style={[styles.dealScore, { backgroundColor: dealScoreColor(item.dealScore) }]}>
            <Text style={styles.dealScoreValue}>{item.dealScore}</Text>
            <Text style={styles.dealScoreLabel}>{t('offers.dealScore')}</Text>
          </View>
        </View>

        <View style={styles.costCard}>
          <CostRow
            label={`${t('offers.quantity')} (${item.unit})`}
            value={String(item.quantity)}
          />
          <CostRow
            label={t('offers.offeredPrice')}
            value={`${formatCurrency(item.offeredPricePerQuintal)} ${t('common.qtl')}`}
          />
          <CostRow
            label={t('offers.transport')}
            value={formatCurrency(item.transportCostPerQuintal)}
            type="cost"
          />
          <CostRow
            label={t('product.otherCosts')}
            value={formatCurrency(item.otherCostsPerQuintal)}
            type="cost"
          />
          <CostRow
            label={t('offers.totalDelivered')}
            value={`${formatCurrency(deliveredCost)} ${t('common.qtl')}`}
            type="net"
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={selected ? t('offers.proceedToOrder') : t('offers.selectOffer')}
            variant={selected ? 'secondary' : 'primary'}
            onPress={() => {
              if (selected) {
                navigation.navigate('ConfirmOrder', {
                  requirementId,
                  offerId: selectedOfferId,
                });
              } else {
                setSelectedOfferId(item.id);
              }
            }}
            style={styles.selectButton}
          />
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('offers.title')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('offers.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadOffers')}
          message={error}
        />
      </View>
    );
  }

  if (!requirement) {
    return (
      <View style={styles.screen}>
        <Header title={t('offers.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="document-text-outline"
          title={t('emptyStates.requirementNotFound')}
          message={t('emptyStates.requirementUnavailable')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('offers.title')} showBack onBack={() => navigation.goBack()} />
      <FlatList
        data={sortedOffers}
        keyExtractor={(item) => item.id}
        renderItem={renderOffer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.requirementHeader}>
            <View style={styles.reqTitleRow}>
              <Text style={styles.reqTitle}>{requirement.cropName}</Text>
              <Badge
                label={requirement.status === 'active' ? t('requirements.active') : t('requirements.completed')}
                type={requirement.status === 'active' ? 'success' : 'info'}
              />
            </View>
            <View style={styles.reqMetaRow}>
              <ReqMeta label={t('offers.quantity')} value={formatQuantity(requirement.quantity, requirement.unit)} />
              <ReqMeta label={t('offers.grade')} value={requirement.grade} />
              <ReqMeta
                label={t('offers.maxExpected')}
                value={`${formatCurrency(requirement.maxPricePerQuintal)} ${t('common.qtl')}`}
              />
            </View>
            <Text style={styles.reqHint}>
              {shortlistedIds.size > 0
                ? `${shortlistedIds.size} ${t('offers.shortlisted')}`
                : t('offers.compareBelow')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="pricetag-outline"
            title={t('offers.noOffersYet')}
            message={t('offers.noOffersHint')}
          />
        }
      />
    </View>
  );
}

function ReqMeta({ label, value }) {
  return (
    <View style={styles.reqMetaItem}>
      <Text style={styles.reqMetaLabel}>{label}</Text>
      <Text style={styles.reqMetaValue}>{value}</Text>
    </View>
  );
}

function CostRow({ label, value, type = 'neutral' }) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.costLabel}>{label}</Text>
      <Text
        style={[
          styles.costValue,
          type === 'cost' && styles.costValueCost,
          type === 'net' && styles.costValueNet,
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
  listContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  requirementHeader: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  reqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  reqTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  reqMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  reqMetaItem: {
    width: '33.33%',
    marginBottom: theme.spacing.sm,
  },
  reqMetaLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  reqMetaValue: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  reqHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sellerBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
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
  shortlistButton: {
    paddingLeft: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  priceValue: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  priceUnit: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  dealScore: {
    width: 64,
    height: 64,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealScoreValue: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textOnPrimary,
  },
  dealScoreLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  costCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  costLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  costValue: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  costValueCost: {
    color: theme.colors.error,
  },
  costValueNet: {
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.bold,
  },
  actions: {
    marginTop: theme.spacing.lg,
  },
  selectButton: {
    width: '100%',
  },
});

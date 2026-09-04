import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchOffersForProduct, fetchProducts } from '../services/productService';
import { formatCurrency, formatDistance } from '../utils/formatting';
import { totalDeliveredCost } from '../utils/calculation';
import Header from '../components/Header';
import Badge from '../components/Badge';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

function selectBestOffer(offers) {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => {
    const diff =
      totalDeliveredCost(a.offeredPricePerQuintal, a.transportCostPerQuintal, a.otherCostsPerQuintal) -
      totalDeliveredCost(b.offeredPricePerQuintal, b.transportCostPerQuintal, b.otherCostsPerQuintal);
    if (diff !== 0) return diff;
    return b.dealScore - a.dealScore;
  })[0];
}

export default function CompareDealsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [products, setProducts] = useState([]);
  const [offersMap, setOffersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const productList = await fetchProducts();
        const entries = await Promise.all(
          productList.map(async (p) => [p.id, await fetchOffersForProduct(p.id)])
        );
        if (cancelled) return;
        setProducts(productList);
        setOffersMap(Object.fromEntries(entries));
      } catch (e) {
        if (!cancelled) setError(e.message || t('emptyStates.couldNotLoadProducts'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t, reloadKey]);

  const compareProducts = useMemo(
    () => products.filter((p) => (offersMap[p.id] || []).length > 0),
    [products, offersMap]
  );

  const product = useMemo(
    () =>
      compareProducts.find((p) => p.id === selectedProductId) ||
      compareProducts[0] ||
      null,
    [compareProducts, selectedProductId]
  );
  const offers = product ? offersMap[product.id] || [] : [];
  const bestOfferId = useMemo(() => {
    const best = selectBestOffer(offers);
    return best ? best.id : null;
  }, [offers]);

  const rows = useMemo(
    () => [
      { label: t('compare.offeredPrice'), render: (o) => `${formatCurrency(o.offeredPricePerQuintal)} ${t('common.qtl')}` },
      { label: t('compare.transport'), render: (o) => formatCurrency(o.transportCostPerQuintal) },
      { label: t('compare.otherCosts'), render: (o) => formatCurrency(o.otherCostsPerQuintal) },
      {
        label: t('compare.deliveredCost'),
        net: true,
        render: (o) =>
          `${formatCurrency(
            totalDeliveredCost(
              o.offeredPricePerQuintal,
              o.transportCostPerQuintal,
              o.otherCostsPerQuintal
            )
          )} ${t('common.qtl')}`,
      },
      { label: t('compare.dealScore'), render: (o) => String(o.dealScore) },
      { label: t('compare.distance'), render: (o) => formatDistance(o.distanceKm) },
    ],
    [t]
  );

  const handleSelect = (offer) => {
    navigation.navigate('ConfirmOrder', {
      requirementId: offer.requirementId,
      offerId: offer.id,
    });
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('compare.title')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('compare.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadProducts')}
          message={error}
        />
        <View style={styles.errorActions}>
          <PrimaryButton title={t('common.retry')} onPress={() => setReloadKey((k) => k + 1)} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title={t('compare.title')} showBack onBack={() => navigation.goBack()} />

      <Text style={styles.hint}>{t('compare.swipeHint')}</Text>

      <View style={styles.productPicker}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerRow}
        >
          {compareProducts.map((p) => {
            const active = p.id === (product && product.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedProductId(p.id)}
                style={[styles.pickerChip, active && styles.pickerChipActive]}
              >
                <Text style={[styles.pickerText, active && styles.pickerTextActive]}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!product || offers.length === 0 ? (
        <EmptyState
          icon="git-compare-outline"
          title={t('emptyStates.noOffersToCompare')}
          message={t('emptyStates.noOffersCompareHint')}
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.table}
          >
            <View style={styles.column}>
              <View style={[styles.cell, styles.headerCell]} />
              {offers.map((offer) => (
                <View
                  key={offer.id}
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.sellerCell,
                    offer.id === bestOfferId && styles.sellerCellBest,
                  ]}
                >
                  <View style={styles.sellerHead}>
                    <Text style={styles.sellerName} numberOfLines={1}>
                      {offer.sellerName}
                    </Text>
                    {offer.id === bestOfferId ? (
                      <Badge label={t('compare.bestValue')} type="success" />
                    ) : null}
                  </View>
                  <View style={styles.sellerMeta}>
                    {offer.verified ? (
                      <Ionicons
                        name="shield-checkmark"
                        size={13}
                        color={theme.colors.success}
                      />
                    ) : null}
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color={theme.colors.secondary} />
                      <Text style={styles.ratingText}>{offer.sellerRating}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {rows.map((row) => (
              <View key={row.label} style={styles.column}>
                <View style={[styles.cell, styles.labelCell]}>
                  <Text style={[styles.labelText, row.net && styles.labelTextNet]}>
                    {row.label}
                  </Text>
                </View>
                {offers.map((offer) => (
                  <View key={offer.id} style={styles.cell}>
                    <Text
                      style={[
                        styles.valueText,
                        row.net && offer.id === bestOfferId && styles.valueTextBest,
                      ]}
                    >
                      {row.render(offer)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.column}>
              <View style={[styles.cell, styles.labelCell]} />
              {offers.map((offer) => (
                <View key={offer.id} style={[styles.cell, styles.actionCell]}>
                  <PrimaryButton
                    title={t('compare.select')}
                    variant={offer.id === bestOfferId ? 'secondary' : 'primary'}
                    onPress={() => handleSelect(offer)}
                    style={styles.selectButton}
                  />
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={styles.bestHint}
              onPress={() => {
                const best = offers.find((o) => o.id === bestOfferId);
                if (best) handleSelect(best);
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.bestHintText}>
                {t('compare.lowestCostHint')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorActions: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  productPicker: {
    marginTop: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: theme.spacing.sm,
  },
  pickerRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.radiusRound,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  pickerChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pickerText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
  },
  pickerTextActive: {
    color: theme.colors.textOnPrimary,
  },
  table: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  column: {
    marginRight: theme.spacing.sm,
  },
  cell: {
    minWidth: 150,
    minHeight: 72,
    padding: theme.spacing.sm,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  headerCell: {
    borderColor: theme.colors.primaryTint,
    backgroundColor: theme.colors.surface,
  },
  sellerCell: {
    borderWidth: 2,
  },
  sellerCellBest: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.badgeSuccess,
  },
  labelCell: {
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textSecondary,
  },
  labelTextNet: {
    color: theme.colors.success,
  },
  valueText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  valueTextBest: {
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.bold,
  },
  sellerHead: {
    marginBottom: theme.spacing.xs,
  },
  sellerName: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    lineHeight: 18,
    marginBottom: theme.spacing.xs,
  },
  sellerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  ratingText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  actionCell: {
    padding: theme.spacing.sm,
  },
  selectButton: {
    alignSelf: 'stretch',
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  bestHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  bestHintText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    lineHeight: 18,
  },
});

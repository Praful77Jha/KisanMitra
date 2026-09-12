import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import {
  TRANSPORT_MODES,
  computeRecommendations,
  QUANTITY_UNIT_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  quantityFromQuintal,
} from '../utils/logistics';
import { formatCurrency } from '../utils/formatting';
import { fetchMarketPrices } from '../services/marketPriceService';
import { fetchProducts, fetchOffersForProduct } from '../services/productService';
import { translateCropName } from '../utils/statusLabels';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function SmartRecommendationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const route = useRoute();

  const [crops, setCrops] = useState([]);
  const [apmcMarkets, setApmcMarkets] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCrop, setSelectedCrop] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('quintal');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [modeKey, setModeKey] = useState('tractor');
  const [otherExpenses, setOtherExpenses] = useState('');
  const [validationError, setValidationError] = useState('');

  const [offersMap, setOffersMap] = useState({});
  const [offersLoading, setOffersLoading] = useState(false);
  const [results, setResults] = useState(null);

  const loadData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([fetchMarketPrices(), fetchProducts()])
      .then(([marketData, productList]) => {
        if (cancelled) return;
        const marketCrops = Array.isArray(marketData.crops) ? marketData.crops : [];
        const productCrops = productList
          .map((p) => p.name)
          .filter((name) => name && String(name).trim().length > 0)
          .map((name) => name.trim());
        const allCrops = Array.from(new Set([...marketCrops, ...productCrops])).sort();
        setCrops(allCrops);
        setApmcMarkets(marketData.prices || []);
        setProducts(productList);
        const requestedCrop = route.params?.crop;
        if (allCrops.length > 0) {
          setSelectedCrop(
            requestedCrop && allCrops.includes(requestedCrop) ? requestedCrop : allCrops[0]
          );
        }
        const requestedQuantity = route.params?.quantity;
        if (requestedQuantity) {
          setQuantity(String(requestedQuantity));
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('recommendation.couldNotLoad'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [t, route.params?.crop, route.params?.quantity]);

  useEffect(() => {
    if (isFocused) return loadData();
    return undefined;
  }, [isFocused, loadData]);

  const matchingProducts = useMemo(
    () => products.filter((p) => (p.name || '').trim().toLowerCase() === selectedCrop.toLowerCase()),
    [products, selectedCrop]
  );

  const loadOffers = useCallback(() => {
    let cancelled = false;
    setOffersLoading(true);
    setError('');
    const productIds = matchingProducts.map((p) => p.id);
    const fetches = productIds.map((id) =>
      fetchOffersForProduct(id).then((offers) => [id, offers]).catch(() => [id, []])
    );
    Promise.all(fetches)
      .then((entries) => {
        if (cancelled) return;
        setOffersMap(Object.fromEntries(entries));
        setOffersLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setOffersMap({});
        setOffersLoading(false);
      });
    return () => { cancelled = true; };
  }, [matchingProducts]);

  useEffect(() => {
    setResults(null);
    setValidationError('');
    if (selectedCrop && matchingProducts.length > 0) {
      return loadOffers();
    }
    setOffersMap({});
    setOffersLoading(false);
    return undefined;
  }, [selectedCrop, matchingProducts, loadOffers]);

  const buyerOffers = useMemo(
    () => Object.values(offersMap).reduce((acc, offers) => acc.concat(offers), []),
    [offersMap]
  );

  const handleFindBest = () => {
    setValidationError('');
    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setValidationError(t('recommendation.validationQuantity'));
      return;
    }
    const dist = Number(distance);
    if (!distance || Number.isNaN(dist) || dist <= 0) {
      setValidationError(t('recommendation.validationDistance'));
      return;
    }

    const apmcForCrop = apmcMarkets.filter(
      (m) => (m.cropName || '').trim().toLowerCase() === selectedCrop.toLowerCase()
    );

    const ranked = computeRecommendations({
      cropName: selectedCrop,
      quantity: qty,
      quantityUnit,
      distanceKm: dist,
      distanceUnit,
      modeKey,
      otherExpenses,
      buyerOffers,
      apmcMarkets: apmcForCrop,
    });

    setResults(ranked);
  };

  const typeLabel = (type) =>
    type === 'buyer_offer' ? t('recommendation.buyerLabel') : t('recommendation.apmcLabel');

  return (
    <View style={styles.screen}>
      <Header title={t('recommendation.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>{t('recommendation.title')}</Text>
        <Text style={styles.subheading}>{t('recommendation.subheading')}</Text>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
          <Text style={styles.noticeText}>{t('recommendation.sourceNotice')}</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error && crops.length === 0 ? (
          <View style={styles.centerState}>
            <EmptyState icon="alert-circle-outline" title={t('recommendation.couldNotLoad')} message={error} />
            <PrimaryButton title={t('common.retry')} onPress={loadData} style={styles.retryButton} />
          </View>
        ) : crops.length === 0 ? (
          <View style={styles.centerState}>
            <EmptyState icon="leaf-outline" title={t('recommendation.noOptions')} message={t('recommendation.noOptionsHint')} />
          </View>
        ) : (
          <>
            <Text style={styles.fieldLabel}>{t('recommendation.selectCrop')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropRow}>
              {crops.map((crop) => (
                <Pressable
                  key={crop}
                  onPress={() => setSelectedCrop(crop)}
                  style={[styles.cropChip, selectedCrop === crop && styles.cropChipActive]}
                >
                  <Text style={[styles.cropChipText, selectedCrop === crop && styles.cropChipTextActive]}>
                    {translateCropName(crop, t)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <InputField
              label={t('recommendation.quantityLabel')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('recommendation.quantityPlaceholder')}
              keyboardType="numeric"
            />
            <View style={styles.unitRow}>
              {QUANTITY_UNIT_OPTIONS.map((u) => (
                <Pressable
                  key={u.value}
                  onPress={() => setQuantityUnit(u.value)}
                  style={[styles.unitChip, quantityUnit === u.value && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, quantityUnit === u.value && styles.unitChipTextActive]}>
                    {t(u.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <InputField
              label={t('recommendation.distanceLabel')}
              value={distance}
              onChangeText={setDistance}
              placeholder={t('recommendation.distancePlaceholder')}
              keyboardType="numeric"
            />
            <View style={styles.unitRow}>
              {DISTANCE_UNIT_OPTIONS.map((u) => (
                <Pressable
                  key={u.value}
                  onPress={() => setDistanceUnit(u.value)}
                  style={[styles.unitChip, distanceUnit === u.value && styles.unitChipActive]}
                >
                  <Text style={[styles.unitChipText, distanceUnit === u.value && styles.unitChipTextActive]}>
                    {t(u.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hintText}>{t('recommendation.distanceHint')}</Text>
            <Text style={styles.hintText}>{t('recommendation.distanceDisclaimer')}</Text>

            <Text style={styles.fieldLabel}>{t('recommendation.transportLabel')}</Text>
            <View style={styles.transportRow}>
              {TRANSPORT_MODES.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setModeKey(m.key)}
                  style={[styles.transportChip, modeKey === m.key && styles.transportChipActive]}
                >
                  <Text style={[styles.transportChipText, modeKey === m.key && styles.transportChipTextActive]}>
                    {t(`logistics.transportModes.${m.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <InputField
              label={t('recommendation.otherExpensesLabel')}
              value={otherExpenses}
              onChangeText={setOtherExpenses}
              placeholder={t('recommendation.otherExpensesPlaceholder')}
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>{t('recommendation.otherExpensesHint')}</Text>

            {validationError ? <Text style={styles.validationError}>{validationError}</Text> : null}

            <PrimaryButton
              title={t('recommendation.calculate')}
              onPress={handleFindBest}
              loading={offersLoading}
              style={styles.findButton}
            />

            {results !== null && results.length === 0 && (
              <View style={styles.emptyBlock}>
                <EmptyState icon="pricetag-outline" title={t('recommendation.noOptions')} message={t('recommendation.noOptionsHint')} />
              </View>
            )}

            {results && results.length > 0 && (
              <>
                <BestOptionCard best={results[0]} second={results[1]} t={t} />
                {results.length > 1 && (
                  <>
                    <Text style={styles.sectionTitle}>{t('recommendation.otherOptions')}</Text>
                    {results.slice(1).map((option, index) => (
                      <OptionCard key={`${option.type}-${option.id}`} option={option} rank={index + 2} typeLabel={typeLabel(option.type)} t={t} />
                    ))}
                  </>
                )}
              </>
            )}

            <View style={styles.discRow}>
              <Ionicons name="warning-outline" size={14} color={theme.colors.textMuted} />
              <Text style={styles.discText}>{t('recommendation.apmcDisclaimer')}</Text>
            </View>
            <View style={styles.discRow}>
              <Ionicons name="warning-outline" size={14} color={theme.colors.textMuted} />
              <Text style={styles.discText}>{t('recommendation.estimateDisclaimer')}</Text>
            </View>
          </>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function BestOptionCard({ best, second, t }) {
  const reasons = [];
  if (!second) {
    reasons.push('onlyOption');
  } else {
    if (best.pricePerQtl > second.pricePerQtl) reasons.push('betterMarketPrice');
    if (best.transportPerQtl < second.transportPerQtl) reasons.push('lowerTransport');
    if (best.amountPerQtl > second.amountPerQtl) reasons.push('higherEarnings');
    if (reasons.length === 0) reasons.push('higherEarnings');
  }

  const unitLabel = t(`recommendation.quantityUnitShort${best.quantityUnit.charAt(0).toUpperCase()}${best.quantityUnit.slice(1)}`);
  const quintals = best.totalAmount / best.amountPerQtl;
  const shownQty = Math.round(quantityFromQuintal(quintals, best.quantityUnit) * 100) / 100;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <Ionicons name="sparkles" size={18} color={theme.colors.primary} />
        <Text style={styles.heroHeaderText}>{t('recommendation.bestOption')}</Text>
      </View>
      <Text style={styles.heroName}>{best.name}</Text>
      <Text style={styles.heroBadge}>{best.type === 'buyer_offer' ? t('recommendation.buyerLabel') : t('recommendation.apmcLabel')}</Text>
      <Text style={styles.heroPrice}>{formatCurrency(best.amountPerQtl)}</Text>
      <Text style={styles.heroPerQtl}>{t('recommendation.estimatedPerQtl')}</Text>
      <Text style={styles.heroTotal}>
        {t('recommendation.estimatedTotalFor', { qty: shownQty, unit: unitLabel })} {formatCurrency(best.totalAmount)} {t('recommendation.estimatedTotal')}
      </Text>

      <View style={styles.whyBlock}>
        <Text style={styles.whyTitle}>{t('recommendation.whyThisOption')}</Text>
        {reasons.map((reason) => (
          <View key={reason} style={styles.reasonRow}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={styles.reasonText}>{t(`recommendation.${reason}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OptionCard({ option, rank, typeLabel, t }) {
  const unitLabel = t(`recommendation.quantityUnitShort${option.quantityUnit.charAt(0).toUpperCase()}${option.quantityUnit.slice(1)}`);
  const quintals = option.totalAmount / option.amountPerQtl;
  const shownQty = Math.round(quantityFromQuintal(quintals, option.quantityUnit) * 100) / 100;

  return (
    <View style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionRank}>#{rank}</Text>
        <Text style={styles.optionName}>{option.name}</Text>
      </View>
      <View style={styles.optionBadgeRow}>
        <Text style={styles.optionType}>{typeLabel}</Text>
      </View>
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>{t('recommendation.estimatedPerQtl')}</Text>
        <Text style={styles.optionValue}>{formatCurrency(option.amountPerQtl)}</Text>
      </View>
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>
          {t('recommendation.estimatedTotalFor', { qty: shownQty, unit: unitLabel })}
        </Text>
        <Text style={styles.optionTotal}>
          {formatCurrency(option.totalAmount)} {t('recommendation.estimatedTotal')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: theme.spacing.xl, paddingTop: theme.spacing.lg },
  heading: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  subheading: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.badgeInfo || '#EEF5FF',
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.info,
    lineHeight: 20,
  },
  centerState: { alignItems: 'center', paddingVertical: theme.spacing.xxl },
  retryButton: { alignSelf: 'stretch', marginTop: theme.spacing.md },
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  cropRow: { gap: theme.spacing.sm, paddingBottom: theme.spacing.lg },
  cropChip: {
    backgroundColor: theme.colors.surfaceAlt || theme.colors.surface,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cropChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  cropChipText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  cropChipTextActive: { color: theme.colors.textOnPrimary },
  hintText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs - 4,
    marginBottom: theme.spacing.md,
    lineHeight: 16,
  },
  unitRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  unitChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.radiusMedium,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt || theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unitChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  unitChipText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
  },
  unitChipTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  transportRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  transportChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.spacing.radiusMedium,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt || theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transportChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  transportChipText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
  },
  transportChipTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  validationError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.sm,
  },
  findButton: { alignSelf: 'stretch', marginTop: theme.spacing.sm },
  emptyBlock: { marginTop: theme.spacing.lg },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  heroCard: {
    backgroundColor: theme.colors.primaryTint || '#E8F5E9',
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  heroHeaderText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  heroName: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
  },
  heroPrice: {
    fontSize: 36,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginTop: theme.spacing.md,
  },
  heroPerQtl: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  heroTotal: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  whyBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  whyTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  reasonText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  optionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  optionRank: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textMuted,
  },
  optionName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  optionBadgeRow: {
    marginTop: theme.spacing.xs,
  },
  optionType: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  optionLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  optionValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  optionTotal: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
  },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  discText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  footerSpacer: { height: theme.spacing.xl },
});
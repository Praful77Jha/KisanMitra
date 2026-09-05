import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { TRANSPORT_MODES, calculateEarnings } from '../utils/logistics';
import { formatCurrency } from '../utils/formatting';
import { fetchMarketPrices } from '../services/marketPriceService';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function MarketComparisonScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const route = useRoute();

  const [crops, setCrops] = useState([]);
  const [prices, setPrices] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [modalPrice, setModalPrice] = useState(null);

  const loadData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchMarketPrices()
      .then((data) => {
        if (cancelled) return;
        setCrops(data.crops);
        setPrices(data.prices);
        setReferenceDate(data.referenceDate || '2026-09-03');
        const requestedCrop = route.params?.crop;
        if (data.crops.length > 0) {
          setSelectedCrop(
            requestedCrop && data.crops.includes(requestedCrop) ? requestedCrop : data.crops[0]
          );
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('marketComparison.couldNotLoad'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [t, route.params?.crop]);

  useEffect(() => {
    if (isFocused) return loadData();
    return undefined;
  }, [isFocused, loadData]);

  const filteredPrices = useMemo(
    () => prices.filter((p) => p.cropName === selectedCrop),
    [prices, selectedCrop]
  );

  const openCalc = useCallback((price) => {
    setModalPrice(price);
    setModalVisible(true);
  }, []);

  return (
    <View style={styles.screen}>
      <Header title={t('marketComparison.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>{t('marketComparison.heading')}</Text>
        <Text style={styles.subheading}>{t('marketComparison.subheading')}</Text>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
          <Text style={styles.noticeText}>{t('marketComparison.sourceNotice')}</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <EmptyState icon="alert-circle-outline" title={t('marketComparison.couldNotLoad')} message={error} />
            <PrimaryButton title={t('common.retry')} onPress={loadData} style={styles.retryButton} />
          </View>
        ) : crops.length === 0 ? (
          <View style={styles.centerState}>
            <EmptyState icon="leaf-outline" title={t('marketComparison.noData')} message={t('marketComparison.noDataHint')} />
          </View>
        ) : (
          <>
            <Text style={styles.cropLabel}>{t('marketComparison.selectCrop')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropRow}>
              {crops.map((crop) => (
                <Pressable
                  key={crop}
                  onPress={() => setSelectedCrop(crop)}
                  style={[styles.cropChip, selectedCrop === crop && styles.cropChipActive]}
                >
                  <Text style={[styles.cropChipText, selectedCrop === crop && styles.cropChipTextActive]}>
                    {t(`cropNames.${crop}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.refDate}>
              {t('marketComparison.refDate', { date: referenceDate })}
            </Text>

            {filteredPrices.map((price) => (
              <MarketCard key={`${price.cropName}-${price.marketName}`} price={price} t={t} onCalculate={openCalc} />
            ))}
          </>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>

      {modalVisible && modalPrice && (
        <CalculatorModal
          price={modalPrice}
          t={t}
          onClose={() => { setModalVisible(false); setModalPrice(null); }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MarketCard — simple card with price and Calculate button
// ---------------------------------------------------------------------------
function MarketCard({ price, t, onCalculate }) {
  return (
    <View style={styles.marketCard}>
      <View style={styles.marketHeader}>
        <View style={styles.marketInfo}>
          <Text style={styles.marketName}>{price.marketName}</Text>
          <Text style={styles.marketPrice}>{formatCurrency(price.pricePerQtl)} / qtl</Text>
        </View>
        <Pressable
          style={styles.calcButton}
          onPress={() => onCalculate(price)}
          hitSlop={6}
        >
          <Ionicons name="calculator-outline" size={18} color={theme.colors.textOnPrimary} />
          <Text style={styles.calcButtonText}>{t('marketComparison.calculate')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CalculatorModal — simple farmer-friendly earnings calculator
// ---------------------------------------------------------------------------
function CalculatorModal({ price, t, onClose }) {
  const [quantity, setQuantity] = useState('');
  const [distance, setDistance] = useState('');
  const [modeKey, setModeKey] = useState(TRANSPORT_MODES[0].key);
  const [otherExpenses, setOtherExpenses] = useState('');

  const quantityNum = Number(quantity) || 0;
  const distanceNum = Number(distance) || 0;
  const otherExpensesNum = Number(otherExpenses) || 0;

  const result = useMemo(() => {
    if (quantityNum <= 0 || distanceNum <= 0) return null;
    return calculateEarnings({
      pricePerQtl: price.pricePerQtl,
      distanceKm: distanceNum,
      quantity: quantityNum,
      modeKey,
      otherExpenses: otherExpensesNum,
    });
  }, [price.pricePerQtl, distanceNum, quantityNum, modeKey, otherExpensesNum]);

  const cropLabel = t(`cropNames.${price.cropName}`);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Text style={styles.modalTitle}>{t('marketComparison.resultTitle')}</Text>
              <Text style={styles.modalSubtitle}>{cropLabel} — {price.marketName}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={32} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* --- Input Fields --- */}
            <View style={styles.calcField}>
              <Text style={styles.calcLabel}>{t('marketComparison.quantityLabel')}</Text>
              <View style={styles.calcInputWrapper}>
                <TextInput value={quantity} onChangeText={setQuantity} placeholder={t('marketComparison.quantityPlaceholder')} keyboardType="numeric" style={styles.calcInput} placeholderTextColor={theme.colors.textMuted} />
                <Text style={styles.calcUnit}>Qtl</Text>
              </View>
            </View>

            <View style={styles.calcField}>
              <Text style={styles.calcLabel}>{t('marketComparison.distanceKm')}</Text>
              <View style={styles.calcInputWrapper}>
                <TextInput value={distance} onChangeText={setDistance} placeholder={t('marketComparison.distancePlaceholder')} keyboardType="numeric" style={styles.calcInput} placeholderTextColor={theme.colors.textMuted} />
                <Text style={styles.calcUnit}>km</Text>
              </View>
            </View>

            <Text style={styles.calcLabel}>{t('logistics.transportModes.title')}</Text>
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

            <View style={styles.calcField}>
              <Text style={styles.calcLabel}>{t('marketComparison.otherExpensesLabel')}</Text>
              <View style={styles.calcInputWrapper}>
                <Text style={styles.calcRupee}>₹</Text>
                <TextInput value={otherExpenses} onChangeText={setOtherExpenses} placeholder={t('marketComparison.otherExpensesPlaceholder')} keyboardType="numeric" style={styles.calcInput} placeholderTextColor={theme.colors.textMuted} />
              </View>
            </View>

            {/* --- Result --- */}
            {result && (
              <>
                {/* Big hero result */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>{t('marketComparison.resultTitle')}</Text>
                  <Text style={styles.heroValue}>
                    {formatCurrency(result.amountPerQtl)}
                  </Text>
                  <Text style={styles.heroUnit}>{t('marketComparison.perQtl')}</Text>
                </View>

                {quantityNum > 0 && (
                  <View style={styles.heroCardSecondary}>
                    <Text style={styles.heroSecondaryLabel}>
                      {t('marketComparison.totalFor', { qty: quantityNum })}
                    </Text>
                    <Text style={styles.heroSecondaryValue}>{formatCurrency(result.totalAmount)}</Text>
                  </View>
                )}

                {/* Breakdown */}
                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('marketComparison.marketPrice')}</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(price.pricePerQtl)}/qtl</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('marketComparison.transport')}</Text>
                    <Text style={styles.breakdownValueNegative}>- {formatCurrency(result.transportPerQtl)}/qtl</Text>
                  </View>
                  {otherExpensesNum > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{t('marketComparison.otherExpenses')}</Text>
                      <Text style={styles.breakdownValueNegative}>- {formatCurrency(result.otherPerQtl)}/qtl</Text>
                    </View>
                  )}
                  <View style={styles.breakdownDivider} />
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabelBold}>{t('marketComparison.youReceive')}</Text>
                    <Text style={styles.breakdownValueBold}>{formatCurrency(result.amountPerQtl)}/qtl</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('marketComparison.totalQuantity')}</Text>
                    <Text style={styles.breakdownValue}>{quantityNum} qtl</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('marketComparison.estimatedTotal')}</Text>
                    <Text style={styles.breakdownValueBold}>{formatCurrency(result.totalAmount)}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Disclaimer */}
            <View style={styles.calcNotice}>
              <Ionicons name="warning-outline" size={14} color={theme.colors.textMuted} />
              <Text style={styles.calcNoticeText}>{t('marketComparison.demoEstimateOnly')}</Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// We need TextInput for the modal inputs
const { TextInput } = require('react-native');

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
  cropLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  cropRow: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
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
  refDate: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  marketCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marketInfo: { flex: 1 },
  marketName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  marketPrice: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
  },
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.radiusMedium,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
  },
  calcButtonText: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
  },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: theme.spacing.xl,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  modalHeaderLeft: { flex: 1, marginRight: theme.spacing.sm },
  modalTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  // --- Calculator inputs ---
  calcField: {
    marginBottom: theme.spacing.md,
  },
  calcLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  calcInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusMedium,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  calcInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  calcUnit: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  calcRupee: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
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

  // --- Hero result ---
  heroCard: {
    backgroundColor: theme.colors.primaryTint || '#E8F5E9',
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  heroUnit: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  heroCardSecondary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroSecondaryLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  heroSecondaryValue: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },

  // --- Breakdown ---
  breakdown: {
    backgroundColor: theme.colors.surfaceAlt || theme.colors.surface,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  breakdownLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  breakdownLabelBold: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  breakdownValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
  },
  breakdownValueBold: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.success,
  },
  breakdownValueNegative: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.error,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
  },

  // --- Disclaimer ---
  calcNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  calcNoticeText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },

  footerSpacer: { height: theme.spacing.xl },
});

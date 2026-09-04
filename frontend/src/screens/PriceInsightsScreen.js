import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchPriceInsights } from '../services/priceInsightsService';
import { formatCurrency } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

const TREND_ICON = {
  up: 'trending-up-outline',
  down: 'trending-down-outline',
  flat: 'remove-outline',
  insufficient: 'help-circle-outline',
};

function trendColor(trend) {
  if (trend === 'up') return theme.colors.success;
  if (trend === 'down') return theme.colors.error;
  if (trend === 'flat') return theme.colors.secondary;
  return theme.colors.textMuted;
}

export default function PriceInsightsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [products, setProducts] = useState([]);
  const [totals, setTotals] = useState({ productCount: 0, orderCount: 0 });
  const [activeName, setActiveName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const data = await fetchPriceInsights();
      setProducts(data.products);
      setTotals(data.totals);
    } catch (e) {
      setError(e.message || t('insights.couldNotLoad'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const lastFocus = React.useRef(0);
  useEffect(() => {
    if (isFocused) {
      const now = Date.now();
      if (now - lastFocus.current > 400) {
        lastFocus.current = now;
        load(false);
      }
    }
  }, [isFocused, load]);

  const selected = useMemo(() => {
    if (!activeName) return null;
    return products.find((p) => p.name === activeName) || null;
  }, [products, activeName]);

  // If the active product disappears after a refresh, clear it.
  useEffect(() => {
    if (activeName && !selected) setActiveName(null);
  }, [selected, activeName]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('insights.title')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const content = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
      }
    >
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
        <Text style={styles.noticeText}>{t('insights.sourceNotice')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => load(false)} style={styles.retryButton} />
        </View>
      ) : null}

      {!error && products.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title={t('insights.noPriceDataYet')}
          message={t('insights.noPriceDataHint')}
        />
      ) : (
        <>
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryText}>
              {t('insights.observedFromOrders', { count: totals.orderCount })}
            </Text>
            <Text style={styles.summaryText}>
              {t('insights.productCount', { count: totals.productCount })}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t('insights.selectProduct')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <CategoryChipLocal
              label={t('common.all')}
              active={!activeName}
              onPress={() => setActiveName(null)}
            />
            {products.map((p) => (
              <CategoryChipLocal
                key={p.name}
                label={p.name}
                active={activeName === p.name}
                onPress={() => setActiveName(p.name)}
              />
            ))}
          </ScrollView>

          {selected ? (
            <ProductInsightCard product={selected} t={t} />
          ) : products.length ? (
            <AllInsightsCard products={products} t={t} />
          ) : null}
        </>
      )}
      <View style={styles.footerSpacer} />
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <Header title={t('insights.title')} showBack onBack={() => navigation.goBack()} />
      {content}
    </View>
  );
}

function CategoryChipLocal({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProductInsightCard({ product, t }) {
  const hasHistory = product.sufficientHistory && product.history && product.history.length >= 2;
  const canTrend = product.trend !== 'insufficient';

  return (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{product.name}</Text>
        <Badge label={product.unit} type="info" />
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>{t('insights.currentPrice')}</Text>
          <Text style={styles.priceValue}>
            {product.latest != null
              ? `${formatCurrency(product.latest)} ${t('common.qtl')}`
              : t('common.notAvailable')}
          </Text>
        </View>
        <View style={styles.trendBlock}>
          <Text style={styles.priceLabel}>{t('insights.trend')}</Text>
          <View style={styles.trendPill}>
            <Ionicons
              name={TREND_ICON[product.trend] || TREND_ICON.insufficient}
              size={16}
              color={trendColor(product.trend)}
            />
            <Text style={[styles.trendText, { color: trendColor(product.trend) }]}>
              {trendLabel(product.trend, t)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBox label={t('insights.averagePrice')} value={product.average != null ? `${formatCurrency(product.average)} ${t('common.qtl')}` : '—'} />
        <StatBox label={t('insights.minimumPrice')} value={product.min != null ? `${formatCurrency(product.min)} ${t('common.qtl')}` : '—'} />
        <StatBox label={t('insights.maximumPrice')} value={product.max != null ? `${formatCurrency(product.max)} ${t('common.qtl')}` : '—'} />
      </View>

      <Text style={styles.recordedOrders}>
        {t('insights.recordedOrders', { count: product.count })}
      </Text>

      <Text style={styles.sectionTitle}>{t('insights.priceHistory')}</Text>
      {hasHistory ? (
        <PriceHistoryChart history={product.history} t={t} />
      ) : (
        <EmptyState
          icon="bar-chart-outline"
          title={t('insights.insufficientDataTitle')}
          message={t('insights.insufficientDataHint')}
        />
      )}
      {!canTrend ? (
        <Text style={styles.trendNote}>{t('insights.trendNeedsMore')}</Text>
      ) : null}
    </View>
  );
}

function trendLabel(trend, t) {
  switch (trend) {
    case 'up': return t('insights.trendUp');
    case 'down': return t('insights.trendDown');
    case 'flat': return t('insights.trendFlat');
    default: return t('insights.trendInsufficient');
  }
}

function AllInsightsCard({ products, t }) {
  return (
    <View style={styles.allCard}>
      <Text style={styles.allCardTitle}>{t('insights.allSummary')}</Text>
      {products.map((p) => (
        <View key={p.name} style={styles.allRow}>
          <View style={styles.allRowLeft}>
            <Text style={styles.allProductName} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.allCount}>
              {t('insights.observedFromOrders', { count: p.count })}
            </Text>
          </View>
          <View style={styles.allRowRight}>
            <Text style={styles.allPrice}>
              {p.latest != null
                ? `${formatCurrency(p.latest)} ${t('common.qtl')}`
                : '—'}
            </Text>
            <Text style={styles.allAvg}>
              {t('insights.averagePrice')}:{' '}
              {p.average != null ? `${formatCurrency(p.average)} ${t('common.qtl')}` : '—'}
            </Text>
          </View>
        </View>
      ))}
      <Text style={styles.allSelectHint}>{t('insights.allSelectHint')}</Text>
    </View>
  );
}

function StatBox({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PriceHistoryChart({ history, t }) {
  const maxPrice = Math.max(...history.map((h) => h.price), 1);
  return (
    <View style={styles.chart}>
      {history.map((point, index) => {
        const barHeight = Math.round((point.price / maxPrice) * 80);
        return (
          <View key={`${point.date || index}-${index}`} style={styles.barCol}>
            <Text style={styles.barPrice} numberOfLines={1}>
              {formatCurrency(point.price)}
            </Text>
            <View style={styles.barTrackV}>
              <View style={[styles.barFillV, { height: `${Math.max(barHeight, 4)}%` }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>
              {point.date || t('insights.unknownDate')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.badgeInfo,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.info,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: { alignSelf: 'stretch' },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  summaryText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  chipRow: {
    paddingRight: theme.spacing.md,
  },
  chip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  selectHint: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  allCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  allCardTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  allRowLeft: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  allProductName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  allCount: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
  },
  allRowRight: {
    alignItems: 'flex-end',
  },
  allPrice: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  allAvg: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  allSelectHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
  productCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  productName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    flexShrink: 1,
    marginRight: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  priceBlock: { flex: 1 },
  priceLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xxs,
  },
  priceValue: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  trendBlock: { alignItems: 'flex-end', marginLeft: theme.spacing.md },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  trendText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  statValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  recordedOrders: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  trendNote: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barPrice: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  barTrackV: {
    height: 80,
    width: 18,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillV: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  barLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
});

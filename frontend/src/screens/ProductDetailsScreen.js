import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useTranslation } from '../i18n';
import { fetchProductById } from '../services/productService';
import { formatCurrency, formatQuantity, formatDistance } from '../utils/formatting';
import { translateCategory } from '../utils/statusLabels';
import { grossRevenue, estimatedNetReturn } from '../utils/calculation';
import Header from '../components/Header';
import PrimaryButton from '../components/PrimaryButton';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';

function dealScoreColor(score) {
  if (score >= 85) return theme.colors.success;
  if (score >= 70) return theme.colors.secondary;
  return theme.colors.warning;
}

export default function ProductDetailsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const productId = route.params?.productId;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProduct = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchProductById(productId)
      .then((data) => {
        if (!cancelled) {
          setProduct(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadProduct'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    return loadProduct();
  }, [loadProduct]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('product.productDetails')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('product.productDetails')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerState}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.productUnavailable')}
            message={error}
          />
          <PrimaryButton
            title={t('common.retry')}
            onPress={loadProduct}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('product.productDetails')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerState}>
          <EmptyState
            icon="cube-outline"
            title={t('emptyStates.productNotFound')}
            message={t('emptyStates.productNoLongerAvailable')}
          />
        </View>
      </View>
    );
  }

  const gross = grossRevenue(product.pricePerQuintal, product.quantity);
  const netReturn = estimatedNetReturn(
    gross,
    product.transportCost,
    product.otherCosts
  );

  const dealRows = [
    { label: t('product.grossRevenue'), value: formatCurrency(gross), type: 'neutral' },
    { label: t('product.transportCost'), value: `- ${formatCurrency(product.transportCost)}`, type: 'cost' },
    { label: t('product.otherCosts'), value: `- ${formatCurrency(product.otherCosts)}`, type: 'cost' },
    { label: t('product.estimatedNetReturn'), value: formatCurrency(netReturn), type: 'net' },
  ];

  return (
    <View style={styles.screen}>
      <Header
        title={t('product.productDetails')}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Image source={product.image} style={styles.image} resizeMode="cover" />

        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.metaRow}>
              <Badge label={t('product.gradeLabel', { grade: product.grade })} type="info" />
              <View style={styles.quantityRow}>
                <Ionicons name="cube-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.quantityText}>
                  {formatQuantity(product.quantity, product.unit)}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.dealScore, { backgroundColor: dealScoreColor(product.dealScore) }]}>
            <Text style={styles.dealScoreValue}>{product.dealScore}</Text>
            <Text style={styles.dealScoreLabel}>{t('product.dealScore')}</Text>
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceValue}>
            {formatCurrency(product.pricePerQuintal)}
          </Text>
          <Text style={styles.priceUnit}>{t('product.quintal')}</Text>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.locationText}>{product.location}</Text>
          <Ionicons name="navigate-outline" size={15} color={theme.colors.textMuted} />
          <Text style={styles.distanceText}>{formatDistance(product.distanceKm)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('product.seller')}</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {product.seller.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{product.seller}</Text>
                {product.verified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={13} color={theme.colors.success} />
                    <Text style={styles.verifiedText}>{t('product.verified')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={theme.colors.secondary} />
                <Text style={styles.ratingText}>{product.sellerRating}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('product.dealBreakdown')}</Text>
          <View style={styles.dealCard}>
            {dealRows.map((row, index) => (
              <View key={row.label} style={styles.dealRow}>
                <Text
                  style={[
                    styles.dealLabel,
                    row.type === 'net' && styles.dealLabelNet,
                  ]}
                >
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.dealValue,
                    row.type === 'cost' && styles.dealValueCost,
                    row.type === 'net' && styles.dealValueNet,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('product.qualityDetails')}</Text>
          <View style={styles.qualityCard}>
            <QualityRow label={t('product.category')} value={translateCategory(product.category, t)} />
            <QualityRow label={t('product.grade')} value={product.grade} />
            <QualityRow label={t('product.available')} value={formatQuantity(product.quantity, product.unit)} />
            <QualityRow label={t('product.price')} value={`${formatCurrency(product.pricePerQuintal)} ${t('product.perQuintal')}`} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('product.description')}</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={t('product.makeOffer')}
            onPress={() =>
              navigation.navigate('MakeOffer', { productId: product.id, product })
            }
            style={styles.offerButton}
          />
          <PrimaryButton
            title={t('product.chat')}
            variant="outline"
            onPress={() => navigation.navigate('Chat', { sellerName: product.seller })}
            style={styles.chatButton}
          />
        </View>
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function QualityRow({ label, value }) {
  return (
    <View style={styles.qualityRow}>
      <Text style={styles.qualityLabel}>{label}</Text>
      <Text style={styles.qualityValue}>{value}</Text>
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
    paddingBottom: theme.spacing.xxl,
  },
  image: {
    width: '100%',
    height: 240,
    backgroundColor: theme.colors.surfaceAlt,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  titleBlock: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  name: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  quantityText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  dealScore: {
    width: 76,
    height: 76,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealScoreValue: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textOnPrimary,
  },
  dealScoreLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  priceValue: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  priceUnit: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  locationText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  distanceText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    marginLeft: 'auto',
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  sellerName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  verifiedBadge: {
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
  dealCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  dealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  dealLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  dealValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  dealValueCost: {
    color: theme.colors.error,
  },
  dealLabelNet: {
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.bold,
  },
  dealValueNet: {
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.bold,
    fontSize: theme.typography.fontSizes.lg,
  },
  qualityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  qualityLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  qualityValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
  },
  description: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xxl,
  },
  offerButton: {
    flex: 1,
  },
  chatButton: {
    flex: 1,
  },
  footerSpacer: {
    height: theme.spacing.md,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
});

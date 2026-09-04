import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import Badge from './Badge';
import { formatCurrency, formatQuantity, formatDistance } from '../utils/formatting';
import { useTranslation } from '../i18n';

export default function ProductCard({ product, onPress, onFavouritePress }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrapper}>
        <Image source={product.image} style={styles.image} resizeMode="cover" />
        <View style={styles.scoreBadge}>
          <Badge label={`${t('product.deal')} ${product.dealScore}`} type="success" />
        </View>
        {onFavouritePress ? (
          <Pressable style={styles.favourite} onPress={onFavouritePress} hitSlop={6}>
            <Ionicons name="heart-outline" size={18} color={theme.colors.textOnPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.grade}>{t('product.gradeLabel', { grade: product.grade })}</Text>
        <Text style={styles.quantity}>{formatQuantity(product.quantity, product.unit)}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(product.pricePerQuintal)}</Text>
          <Text style={styles.perUnit}>{t('product.perQuintal')}</Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>
            {product.location} · {formatDistance(product.distanceKm)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: {
    opacity: 0.95,
  },
  imageWrapper: {
    height: 130,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surfaceAlt,
  },
  scoreBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
  },
  favourite: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.overlay,
    borderRadius: theme.spacing.radiusRound,
    padding: theme.spacing.xs + 2,
  },
  body: {
    padding: theme.spacing.md,
  },
  name: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  grade: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
  },
  quantity: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: theme.spacing.sm,
  },
  price: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  perUnit: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xxs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  metaText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xxs,
  },
});

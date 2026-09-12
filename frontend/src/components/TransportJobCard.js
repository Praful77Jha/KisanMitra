import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import {
  jobStatusLabel,
  jobStatusTone,
} from '../utils/transportStatus';
import { formatQuantity, formatDate } from '../utils/formatting';
import Badge from './Badge';
import { useTranslation } from '../i18n';

// Shared card for transport job lists (active jobs + completed jobs). The job
// record does not carry crop/route details, so the caller joins the transport
// request and passes it in.
export default function TransportJobCard({ job, request, onPress }) {
  const { t } = useTranslation();
  const cropName = request ? request.cropName : t('transport.jobTitle');
  const quantity = request ? formatQuantity(request.quantity, request.unit) : '';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cropName} numberOfLines={1}>{cropName}</Text>
          {quantity ? <Text style={styles.quantity}>{quantity}</Text> : null}
        </View>
        <Badge label={jobStatusLabel(job.status, t)} type={jobStatusTone(job.status)} />
      </View>

      {request ? (
        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <Ionicons name="arrow-up-circle-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.routeText} numberOfLines={1}>{request.pickupLocation}</Text>
          </View>
          <View style={styles.routeRow}>
            <Ionicons name="arrow-down-circle-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.routeText} numberOfLines={1}>{request.dropLocation}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {request && request.requiredBy
            ? t('transport.neededBy', { date: formatDate(request.requiredBy) })
            : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
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
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cardTitleBlock: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  cropName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  quantity: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  routeBlock: {
    gap: theme.spacing.xs,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  routeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  metaText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
});
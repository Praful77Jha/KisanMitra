import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import { getTransporterReviews } from '../services/transportService';
import { formatDateShort } from '../utils/formatting';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function TransporterReviewsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const transporterId = route.params?.transporterId || user?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getTransporterReviews(transporterId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('transport.couldNotLoadReviews'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [transporterId, t]);

  useEffect(() => {
    return load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.ratings')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.ratings')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransporterRatings')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  const reviews = (data && data.reviews) || [];

  return (
    <View style={styles.screen}>
      <Header title={t('transport.ratings')} showBack onBack={() => navigation.goBack()} />
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.summaryCard}>
            {data.average != null ? (
              <Text style={styles.summaryAverage}>{data.average} / 5</Text>
            ) : (
              <Text style={styles.summaryEmpty}>{t('reviews.noReviews')}</Text>
            )}
            <Text style={styles.summaryCount}>
              {t('transport.reviewCount', { count: data.count })}
            </Text>
            <View style={styles.summaryStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= Math.round(data.average || 0) ? 'star' : 'star-outline'}
                  size={20}
                  color={theme.colors.warning}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title={t('emptyStates.noTransporterRatings')}
            message={t('emptyStates.noTransporterRatingsHint')}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons
                    key={n}
                    name={n <= item.rating ? 'star' : 'star-outline'}
                    size={15}
                    color={theme.colors.warning}
                  />
                ))}
              </View>
              <Text style={styles.date}>{formatDateShort(item.createdAt)}</Text>
            </View>
            {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  listContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  summaryAverage: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  summaryEmpty: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textMuted,
  },
  summaryCount: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: theme.spacing.xxs,
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
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  date: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  comment: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
});
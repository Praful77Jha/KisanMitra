import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import { fetchUserReviews } from '../services/reviewService';
import { formatDate } from '../utils/formatting';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function MyRatingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      setLoading(true);
      setError('');
      fetchUserReviews(user.id)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .catch(() => {
          if (!cancelled) setError(t('reviews.couldNotLoad'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [user?.id])
  );

  const reviews = (data && data.reviews) || [];
  const average = data ? data.average : null;

  return (
    <View style={styles.screen}>
      <Header title={t('reviews.title')} showBack onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.state}>
          <EmptyState icon="alert-circle-outline" title={t('reviews.couldNotLoad')} message={error} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.state}>
          <EmptyState
            icon="star-outline"
            title={t('reviews.noReviews')}
            message={t('reviews.myRatingsProfileHint')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryAverage}>
              {average != null ? `${average} / 5` : '–'}
            </Text>
            <Text style={styles.summaryCount}>
              {t('reviews.reviewCount', { count: reviews.length })}
            </Text>
            <View style={styles.summaryStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={average != null && n <= Math.round(average) ? 'star' : 'star-outline'}
                  size={18}
                  color={theme.colors.warning}
                />
              ))}
            </View>
          </View>

          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerBlock}>
                  <View style={styles.reviewerAvatar}>
                    <Text style={styles.reviewerAvatarText}>
                      {review.reviewerName
                        ? review.reviewerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                        : '?'}
                    </Text>
                  </View>
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>
                      {review.reviewerName || t('common.user')}
                    </Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Ionicons
                          key={n}
                          name={n <= review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={theme.colors.warning}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                {review.createdAt ? (
                  <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                ) : null}
              </View>
              {review.comment ? (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              ) : (
                <Text style={styles.reviewNoComment}>{t('reviews.noComment')}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  state: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  summaryAverage: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  summaryCount: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xxs,
  },
  starRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  reviewDate: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  reviewComment: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  reviewNoComment: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: theme.spacing.md,
  },
});

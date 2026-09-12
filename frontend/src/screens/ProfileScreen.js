import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import { fetchRequirements, fetchOrders } from '../services/productService';
import { fetchUserReviews } from '../services/reviewService';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation, useLanguage } from '../i18n';
import { transportProfileActions } from '../utils/transportRole';

function initials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout, role } = useAuth();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  const [requirementCount, setRequirementCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [ratingInfo, setRatingInfo] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([fetchRequirements(), fetchOrders()])
        .then(([requirements, orders]) => {
          if (!cancelled) {
            setRequirementCount(requirements.length);
            setOrderCount(orders.length);
          }
        })
        .catch(() => {
          // Counts are best-effort; a failure just leaves the counts at zero.
        });
      return () => { cancelled = true; };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      setRatingLoading(true);
      fetchUserReviews(user.id)
        .then((data) => {
          if (!cancelled) setRatingInfo(data);
        })
        .catch(() => {
          // Best-effort; leave the ratings card hidden on failure.
        })
        .finally(() => {
          if (!cancelled) setRatingLoading(false);
        });
      return () => { cancelled = true; };
    }, [user?.id])
  );

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (_) {
      // RootNavigator reacts to user === null to return to Auth.
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={styles.identityCard}>
          <View style={[styles.avatar, { backgroundColor: user?.avatarColor || theme.colors.primary }]}>
            <Text style={styles.avatarText}>{initials(user?.name || t('common.user'))}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.name}>{user?.name || t('common.user')}</Text>
            <InfoLine icon="call-outline" text={user?.phone || ''} />
            <InfoLine icon="location-outline" text={user?.location || ''} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('profile.activity')}</Text>
        <View style={styles.activityCard}>
          <ActivityRow
            icon="document-text-outline"
            label={t('profile.postedRequirements')}
            count={requirementCount}
            onPress={() => navigation.navigate('MyRequirements')}
          />
          <View style={styles.divider} />
          <ActivityRow
            icon="receipt-outline"
            label={t('profile.myOrders')}
            count={orderCount}
            onPress={() => navigation.navigate('Orders')}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('reviews.title')}</Text>
        <Pressable
          style={({ pressed }) => [styles.activityCard, pressed && styles.ratingCardPressed]}
          onPress={() => navigation.navigate('MyRatings')}
        >
          <View style={styles.ratingRow}>
            <View style={styles.ratingIcon}>
              <Ionicons name="star" size={20} color={theme.colors.warning} />
            </View>
            <View style={styles.ratingBody}>
              {ratingLoading ? (
                <Text style={styles.ratingEmpty}>{t('common.loading')}</Text>
              ) : ratingInfo && ratingInfo.count > 0 ? (
                <>
                  <Text style={styles.ratingLabel}>
                    {`${ratingInfo.average} / 5`}
                  </Text>
                  <Text style={styles.ratingCount}>
                    {t('reviews.reviewCount', { count: ratingInfo.count })}
                  </Text>
                </>
              ) : (
                <Text style={styles.ratingEmpty}>{t('reviews.noReviews')}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>{t('profile.transport')}</Text>
        <View style={styles.activityCard}>
          {transportProfileActions(role).map((action, index) => (
            <React.Fragment key={action.key}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <ActivityRow
                icon={action.icon}
                label={t(action.labelKey)}
                count=""
                onPress={() => navigation.navigate(action.screen)}
              />
            </React.Fragment>
          ))}
        </View>

        <View style={styles.languageCard}>
          <Text style={styles.languageLabel}>{t('profile.language')}</Text>
          <View style={styles.languageOptions}>
            {[
              { key: 'en' },
              { key: 'mr' },
              { key: 'hi' },
              { key: 'lmn' },
            ].map((lang) => (
              <Pressable
                key={lang.key}
                onPress={() => setLanguage(lang.key)}
                style={[
                  styles.languageOption,
                  language === lang.key && styles.languageOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    language === lang.key && styles.languageOptionTextActive,
                  ]}
                >
                  {t(`languages.${lang.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <PrimaryButton
          title={t('profile.signOut')}
          variant="outline"
          onPress={handleSignOut}
          style={styles.signOut}
        />
      </ScrollView>
    </View>
  );
}

function InfoLine({ icon, text }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={14} color={theme.colors.textSecondary} />
      <Text style={styles.infoText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ActivityRow({ icon, label, count, onPress }) {
  return (
    <Pressable style={styles.activityRow} onPress={onPress}>
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityLabel}>{label}</Text>
        <Text style={styles.activityCount}>{count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textOnPrimary,
  },
  identityInfo: {
    flex: 1,
  },
  name: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
  },
  infoText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  activityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusMedium,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
  },
  activityLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  activityCount: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  ratingCardPressed: {
    opacity: 0.8,
  },
  ratingIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusMedium,
    backgroundColor: theme.colors.badgeWarning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBody: {
    flex: 1,
  },
  ratingLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.bold,
  },
  ratingCount: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
  },
  ratingEmpty: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  languageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  languageLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  languageOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.spacing.radiusMedium,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  languageOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  languageOptionText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
  },
  languageOptionTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  signOut: {
    marginTop: theme.spacing.xxl,
  },
});

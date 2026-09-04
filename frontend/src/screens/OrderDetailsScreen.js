import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchOrderById, cancelOrder } from '../services/productService';
import {
  fetchOrderReviews,
  submitReview,
  updateReview,
  deleteReview,
} from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatQuantity, formatDate, formatDateShort } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

function statusType(status) {
  if (status === 'Delivered') return 'success';
  return 'info';
}

// 'paid' -> 'Paid' to map onto payment.statePaid etc.
function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function OrderDetailsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const orderId = route.params?.orderId;

  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOrderById(orderId)
      .then((data) => {
        if (!cancelled) {
          setOrder(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadOrder'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    if (!order || order.status !== 'Delivered') return;
    let cancelled = false;
    setReviewsLoading(true);
    setReviewError('');
    fetchOrderReviews(orderId)
      .then((data) => {
        if (!cancelled) {
          setReviews(Array.isArray(data) ? data : []);
          setReviewsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReviewError(t('reviews.couldNotLoad'));
          setReviewsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [order, orderId]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderDetails.title')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderDetails.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadOrder')}
          message={error}
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <Header title={t('orderDetails.title')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="receipt-outline"
          title={t('emptyStates.orderNotFound')}
          message={t('emptyStates.orderNotFoundHint')}
        />
      </View>
    );
  }

  const currentStageIndex = order.timeline.reduce(
    (acc, entry, index) => (entry.done ? index : acc),
    -1
  );

  const myReview = reviews.find((r) => r.reviewerId === user?.id) || null;

  const handleSubmit = async () => {
    if (rating < 1) {
      setSubmitError(t('reviews.ratingRequired'));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      if (myReview && editing) {
        await updateReview(orderId, myReview.id, { rating, comment: comment.trim() || undefined });
      } else {
        await submitReview(orderId, { rating, comment: comment.trim() || undefined });
      }
      const data = await fetchOrderReviews(orderId);
      setReviews(Array.isArray(data) ? data : []);
      setEditing(false);
      setRating(0);
      setComment('');
    } catch (e) {
      setSubmitError(e.message || t('reviews.couldNotSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    setRating(myReview.rating);
    setComment(myReview.comment || '');
    setEditing(true);
    setSubmitError('');
  };

  const handleDelete = () => {
    Alert.alert(t('reviews.deleteConfirm'), '', [
      { text: t('reviews.cancel'), style: 'cancel' },
      {
        text: t('reviews.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReview(orderId, myReview.id);
            const data = await fetchOrderReviews(orderId);
            setReviews(Array.isArray(data) ? data : []);
            setEditing(false);
            setRating(0);
            setComment('');
          } catch (e) {
            setSubmitError(e.message || t('reviews.couldNotSubmit'));
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(t('orderDetails.cancelTitle'), t('orderDetails.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('orderDetails.cancelOrder'),
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await cancelOrder(orderId);
            setOrder(updated);
          } catch (e) {
            Alert.alert(t('common.error'), e.message || t('orderDetails.cancelFailed'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Header title={t('orderDetails.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.orderIdRow}>
            <View style={styles.orderIdBlock}>
              <Text style={styles.orderIdLabel}>{t('orderDetails.orderId')}</Text>
              <Text style={styles.orderId}>{order.id}</Text>
            </View>
            <Badge label={order.status} type={statusType(order.status)} />
          </View>
          <View style={styles.divider} />
          <InfoRow label={t('orderDetails.product')} value={order.productName} />
          <InfoRow label={t('orderDetails.quantity')} value={formatQuantity(order.quantity, order.unit)} />
          <InfoRow label={t('orderDetails.orderDate')} value={formatDate(order.orderDate)} />
        </View>

        <Text style={styles.sectionTitle}>{t('orderDetails.seller')}</Text>
        <View style={styles.card}>
          <InfoRow label={t('orderDetails.seller')} value={order.sellerName} />
          <InfoRow label={t('orderDetails.deliveryAddress')} value={order.deliveryAddress} />
        </View>

        <Text style={styles.sectionTitle}>{t('orderDetails.payment')}</Text>
        <View style={styles.card}>
          <InfoRow label={t('orderDetails.paymentMethod')} value={order.paymentMethod} />
          {order.paymentState ? (
            <InfoRow label={t('payment.state')} value={t(`payment.state${cap(order.paymentState)}`)} />
          ) : null}
          {order.paymentRef ? (
            <InfoRow label={t('paymentResult.reference')} value={order.paymentRef} />
          ) : null}
          <InfoRow
            label={t('orderDetails.price')}
            value={`${formatCurrency(order.pricePerQuintal)} / ${order.unit.toLowerCase()}`}
          />
          <InfoRow label={t('orderDetails.transportCost')} value={formatCurrency(order.transportCost)} />
          <InfoRow label={t('orderDetails.otherCharges')} value={formatCurrency(order.otherCharges)} />
          <InfoRow label={t('orderDetails.platformFee')} value={formatCurrency(order.platformFee)} />
          <View style={styles.divider} />
          <InfoRow label={t('orderDetails.totalAmount')} value={formatCurrency(order.totalAmount)} type="net" />
        </View>

        <Text style={styles.sectionTitle}>{t('orderDetails.tracking')}</Text>
        <View style={styles.card}>
          <Timeline entries={order.timeline} currentIndex={currentStageIndex} />
        </View>

        <Text style={styles.sectionTitle}>{t('logistics.orderTitle')}</Text>
        <Pressable
          style={({ pressed }) => [styles.logisticsCard, pressed && styles.logisticsCardPressed]}
          onPress={() => navigation.navigate('Logistics', { orderId })}
        >
          <Ionicons name="car-outline" size={22} color={theme.colors.primary} />
          <View style={styles.logisticsCardText}>
            <Text style={styles.logisticsCardTitle}>{t('logistics.trackLogistics')}</Text>
            <Text style={styles.logisticsCardSubtitle}>{t('logistics.manageDeliveryStatus')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>{t('chat.title')}</Text>
        <Pressable
          style={({ pressed }) => [styles.logisticsCard, pressed && styles.logisticsCardPressed]}
          onPress={() => navigation.navigate('Chat', { orderId, sellerName: order.sellerName })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.primary} />
          <View style={styles.logisticsCardText}>
            <Text style={styles.logisticsCardTitle}>{t('chat.openChat')}</Text>
            <Text style={styles.logisticsCardSubtitle}>
              {t('chat.messageSeller')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </Pressable>

        {order.status === 'Order Confirmed' ? (
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            onPress={handleCancel}
          >
            <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
            <Text style={styles.cancelButtonText}>{t('orderDetails.cancelOrder')}</Text>
          </Pressable>
        ) : null}

        {order.status === 'Delivered' ? (
          <ReviewSection
            t={t}
            reviewsLoading={reviewsLoading}
            reviews={reviews}
            myReview={myReview}
            reviewError={reviewError}
            rating={rating}
            setRating={setRating}
            comment={comment}
            setComment={setComment}
            submitting={submitting}
            submitError={submitError}
            editing={editing}
            onSubmit={handleSubmit}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function Timeline({ entries, currentIndex }) {
  return (
    <View>
      {entries.map((entry, index) => {
        const isCompleted = entry.done === true;
        const isCurrent = index === currentIndex && !isCompleted;
        const isPending = !isCompleted && !isCurrent;
        const isLast = index === entries.length - 1;

        return (
          <View key={`${entry.step}-${index}`} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              {isCompleted ? (
                <View style={[styles.node, styles.nodeCompleted]}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.textOnPrimary} />
                </View>
              ) : isCurrent ? (
                <View style={[styles.node, styles.nodeCurrent]}>
                  <View style={styles.nodeCurrentInner} />
                </View>
              ) : (
                <View style={[styles.node, styles.nodePending]}>
                  <View style={styles.nodePendingInner} />
                </View>
              )}
              {!isLast ? (
                <View style={[styles.railLine, isCompleted && styles.railLineCompleted]} />
              ) : null}
            </View>
            <View style={styles.timelineBody}>
              <Text
                style={[
                  styles.timelineStep,
                  isCompleted && styles.timelineStepCompleted,
                  isCurrent && styles.timelineStepCurrent,
                  isPending && styles.timelineStepPending,
                ]}
              >
                {entry.step}
              </Text>
              {entry.date ? (
                <Text style={styles.timelineDate}>{formatDateShort(entry.date)}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function InfoRow({ label, value, type = 'neutral' }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          type === 'net' && styles.infoValueNet,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function averageRating(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 100) / 100;
}

function StarRating({ value, onChange }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={30}
            color={n <= value ? theme.colors.warning : theme.colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewForm({
  t,
  rating,
  setRating,
  comment,
  setComment,
  submitting,
  submitError,
  editing,
  onSubmit,
}) {
  return (
    <View style={styles.reviewForm}>
      <Text style={styles.reviewSubLabel}>
        {editing ? t('reviews.update') : t('reviews.rateOrder')}
      </Text>
      <Text style={styles.reviewHint}>{t('reviews.rateSubtitle')}</Text>

      <Text style={styles.reviewFieldLabel}>{t('reviews.yourRating')}</Text>
      <StarRating value={rating} onChange={setRating} />

      <Text style={styles.reviewFieldLabel}>{t('reviews.comment')}</Text>
      <TextInput
        style={styles.reviewInput}
        value={comment}
        onChangeText={setComment}
        placeholder={t('reviews.commentPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={1200}
        editable={!submitting}
      />

      {submitError ? <Text style={styles.reviewError}>{submitError}</Text> : null}

      <PrimaryButton
        title={editing ? t('reviews.update') : t('reviews.submit')}
        loading={submitting}
        onPress={onSubmit}
        style={styles.reviewSubmit}
      />
    </View>
  );
}

function ReviewSummary({ t, review, onEdit, onDelete }) {
  return (
    <View style={styles.reviewSummaryBlock}>
      <Text style={styles.reviewSubLabel}>{t('reviews.alreadyRated')}</Text>
      <Text style={styles.myReviewStars}>
        {t('reviews.ratedStars', { rating: review.rating })}
      </Text>
      {review.comment ? (
        <Text style={styles.myReviewComment}>{review.comment}</Text>
      ) : null}
      <View style={styles.reviewActions}>
        <Pressable style={styles.reviewActionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.reviewActionText}>{t('reviews.edit')}</Text>
        </Pressable>
        <Pressable style={styles.reviewActionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
          <Text style={[styles.reviewActionText, { color: theme.colors.error }]}>
            {t('reviews.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReviewSection({
  t,
  reviewsLoading,
  reviews,
  myReview,
  reviewError,
  rating,
  setRating,
  comment,
  setComment,
  submitting,
  submitError,
  editing,
  onSubmit,
  onEdit,
  onDelete,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitleInline}>{t('reviews.title')}</Text>

      {reviewError ? <Text style={styles.reviewError}>{reviewError}</Text> : null}

      {reviewsLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.reviewLoading} />
      ) : (
        <>
          {reviews.length > 0 ? (
            <View style={styles.reviewList}>
              <Text style={styles.reviewSubLabel}>{t('reviews.orderReviews')}</Text>
              <Text style={styles.reviewSummary}>
                {t('reviews.averageRating')}: {averageRating(reviews)} / 5 · {reviews.length}
              </Text>
            </View>
          ) : (
            <Text style={styles.reviewEmpty}>{t('reviews.noReviews')}</Text>
          )}

          <View style={styles.divider} />

          {myReview && !editing ? (
            <ReviewSummary t={t} review={myReview} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <ReviewForm
              t={t}
              rating={rating}
              setRating={setRating}
              comment={comment}
              setComment={setComment}
              submitting={submitting}
              submitError={submitError}
              editing={!!myReview && editing}
              onSubmit={onSubmit}
            />
          )}
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
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  orderIdBlock: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  orderIdLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.medium,
  },
  orderId: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginTop: theme.spacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  logisticsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  logisticsCardPressed: { opacity: 0.85 },
  logisticsCardText: { flex: 1 },
  logisticsCardTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  logisticsCardSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  infoValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueNet: {
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.bold,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineRail: {
    alignItems: 'center',
    width: 28,
    marginRight: theme.spacing.md,
  },
  node: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCompleted: {
    backgroundColor: theme.colors.success,
  },
  nodeCurrent: {
    backgroundColor: theme.colors.primary,
  },
  nodeCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textOnPrimary,
  },
  nodePending: {
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    borderRadius: 12,
  },
  nodePendingInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
  },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xxs,
  },
  railLineCompleted: {
    backgroundColor: theme.colors.success,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: theme.spacing.lg,
  },
  timelineStep: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
  },
  timelineStepCompleted: {
    color: theme.colors.textPrimary,
  },
  timelineStepCurrent: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.bold,
  },
  timelineStepPending: {
    color: theme.colors.textMuted,
  },
  timelineDate: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
  },
  sectionTitleInline: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  reviewLoading: {
    marginVertical: theme.spacing.lg,
  },
  reviewList: {
    marginBottom: theme.spacing.sm,
  },
  reviewSubLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewSummary: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.medium,
    marginTop: theme.spacing.xxs,
  },
  reviewEmpty: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  reviewError: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  reviewSummaryBlock: {
    marginTop: theme.spacing.sm,
  },
  myReviewStars: {
    fontSize: theme.typography.fontSizes.xl,
    color: theme.colors.warning,
    fontWeight: theme.typography.fontWeights.bold,
    marginTop: theme.spacing.xs,
  },
  myReviewComment: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  reviewActionText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  reviewForm: {
    marginTop: theme.spacing.sm,
  },
  reviewHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.md,
  },
  reviewFieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  starRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  reviewInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceAlt,
    textAlignVertical: 'top',
  },
  reviewSubmit: {
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  cancelButtonPressed: {
    opacity: 0.8,
  },
  cancelButtonText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.error,
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
});

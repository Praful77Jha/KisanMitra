import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  getTransportJob,
  getTransportRequest,
  getTransportQuotes,
  updateTransportJobStatus,
  createTransportReview,
} from '../services/transportService';
import { isTransporter } from '../utils/transportRole';
import {
  jobStatusLabel,
  jobStatusTone,
  jobTimeline,
  nextJobStatuses,
} from '../utils/transportStatus';
import { isValidTransportRating } from '../utils/transportValidation';
import { formatCurrency, formatQuantity, formatDate, formatDateTime } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function TransportJobScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const jobId = route.params?.jobId;
  const { role } = useAuth();
  const transporter = isTransporter(role);

  const [job, setJob] = useState(null);
  const [request, setRequest] = useState(null);
  const [acceptedQuote, setAcceptedQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const loadRequest = getTransportJob(jobId).then(async (jobData) => {
      let requestData = null;
      if (jobData && jobData.transportRequestId) {
        requestData = await getTransportRequest(jobData.transportRequestId).catch(() => null);
      }
      let accepted = null;
      if (!transporter && jobData && jobData.transportRequestId) {
        const quotes = await getTransportQuotes(jobData.transportRequestId).catch(() => null);
        if (Array.isArray(quotes)) {
          accepted = quotes.find((q) => q.status === 'ACCEPTED') || null;
        }
      }
      return { jobData, requestData, accepted };
    });
    loadRequest
      .then(({ jobData, requestData, accepted }) => {
        if (cancelled) return;
        setJob(jobData);
        setRequest(requestData);
        setAcceptedQuote(accepted);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadJob'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [jobId, transporter, t]);

  useEffect(() => {
    return load();
  }, [load]);

  const handleStatusChange = (nextStatus) => {
    const apply = async () => {
      setUpdating(true);
      setUpdateError('');
      try {
        await updateTransportJobStatus(jobId, nextStatus);
        const updatedJob = await getTransportJob(jobId);
        setJob(updatedJob);
        if (updatedJob.transportRequestId) {
          const requestData = await getTransportRequest(updatedJob.transportRequestId).catch(() => null);
          setRequest(requestData);
        }
      } catch (e) {
        setUpdateError(e.message || t('transport.couldNotUpdateStatus'));
      } finally {
        setUpdating(false);
      }
    };

    if (nextStatus === 'CANCELLED') {
      Alert.alert(
        t('transport.confirmCancelTitle'),
        t('transport.confirmCancelMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('transport.cancelJob'), style: 'destructive', onPress: apply },
        ]
      );
    } else {
      apply();
    }
  };

  const handleReviewSubmit = async () => {
    if (!isValidTransportRating(rating)) {
      setReviewError(t('transport.ratingRequired'));
      return;
    }
    setSubmittingReview(true);
    setReviewError('');
    try {
      await createTransportReview(jobId, { rating, comment });
      setReviewed(true);
    } catch (e) {
      setReviewError(e.message || t('transport.couldNotSubmitReview'));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.jobTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.jobTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransportJob')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.jobTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="car-outline"
            title={t('emptyStates.noTransportJobs')}
            message={t('emptyStates.noTransportJobsHint')}
          />
        </View>
      </View>
    );
  }

  const timeline = jobTimeline(job.status);
  const nextStatuses = nextJobStatuses(job.status);
  const canUpdate = transporter && nextStatuses.length > 0;
  const showReview = !transporter && job.status === 'DELIVERED' && !reviewed;

  return (
    <View style={styles.screen}>
      <Header title={t('transport.jobTitle')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.statusLabel}>{t('transport.latestStatus')}</Text>
            <Badge label={jobStatusLabel(job.status, t)} type={jobStatusTone(job.status)} />
          </View>

          {request ? (
            <View style={styles.jobMeta}>
              <Text style={styles.cropName}>{request.cropName}</Text>
              <Text style={styles.quantity}>
                {formatQuantity(request.quantity, request.unit)}
              </Text>
            </View>
          ) : null}
          {acceptedQuote ? (
            <>
              <View style={styles.divider} />
              {acceptedQuote.transporterName ? (
                <InfoRow label={t('transport.transporter')} value={acceptedQuote.transporterName} />
              ) : null}
              <InfoRow
                label={t('transport.quotedPrice')}
                value={formatCurrency(acceptedQuote.quotedAmount)}
              />
              <InfoRow label={t('transport.vehicleType')} value={acceptedQuote.vehicleType} />
            </>
          ) : null}
        </View>

        {request ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitleInline}>{t('transport.route')}</Text>
            <View style={styles.divider} />
            <InfoRow label={t('transport.pickup')} value={request.pickupLocation} />
            <InfoRow label={t('transport.drop')} value={request.dropLocation} />
            {request.requiredBy ? (
              <InfoRow label={t('transport.requiredBy')} value={formatDate(request.requiredBy)} />
            ) : null}
            {request.orderId ? (
              <InfoRow label={t('transport.linkedOrder')} value={request.orderId} />
            ) : null}
            {job.updatedAt ? (
              <InfoRow label={t('transport.updatedAt')} value={formatDateTime(job.updatedAt)} />
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('transport.jobTimeline')}</Text>
        <View style={styles.card}>
          <TransportTimeline timeline={timeline} t={t} />
        </View>

        {updateError ? <Text style={styles.errorText}>{updateError}</Text> : null}

        {canUpdate ? (
          <View style={styles.statusActions}>
            <Text style={styles.statusActionsLabel}>{t('transport.updateStatus')}</Text>
            {nextStatuses.map((nextStatus) =>
              nextStatus === 'CANCELLED' ? (
                <Pressable
                  key={nextStatus}
                  style={({ pressed }) => [styles.cancelStatusButton, pressed && styles.cardPressed]}
                  onPress={() => handleStatusChange(nextStatus)}
                  disabled={updating}
                >
                  <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
                  <Text style={styles.cancelStatusText}>{t('transport.cancelJob')}</Text>
                </Pressable>
              ) : (
                <PrimaryButton
                  key={nextStatus}
                  title={t('transport.markStatus', { status: jobStatusLabel(nextStatus, t) })}
                  onPress={() => handleStatusChange(nextStatus)}
                  loading={updating}
                  disabled={updating}
                  style={styles.statusButton}
                />
              )
            )}
          </View>
        ) : (
          !transporter && (
            <Text style={styles.viewOnly}>{t('transport.statusFromTransporter')}</Text>
          )
        )}

        {showReview ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitleInline}>{t('transport.reviewTitle')}</Text>
            <Text style={styles.reviewHint}>{t('transport.ratingSubtitle')}</Text>

            {reviewError ? <Text style={styles.errorText}>{reviewError}</Text> : null}

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={8}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={30}
                    color={n <= rating ? theme.colors.warning : theme.colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t('transport.reviewComment')}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={1200}
              editable={!submittingReview}
            />

            <PrimaryButton
              title={submittingReview ? t('common.submitting') : t('transport.reviewSubmit')}
              onPress={handleReviewSubmit}
              loading={submittingReview}
              disabled={submittingReview}
              style={styles.reviewSubmit}
            />
          </View>
        ) : null}

        {!transporter && job.status === 'DELIVERED' && reviewed ? (
          <View style={styles.card}>
            <View style={styles.reviewSuccess}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
              <Text style={styles.reviewSuccessText}>{t('transport.reviewSubmitted')}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

function TransportTimeline({ timeline, t }) {
  if (!timeline || timeline.length === 0) {
    return <Text style={styles.timelineCancelled}>{t('transport.timelineNone')}</Text>;
  }
  return (
    <View>
      {timeline.map((step, index) => {
        const isLast = index === timeline.length - 1;
        return (
          <View key={step.status} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              {step.done ? (
                <View style={[styles.node, styles.nodeCompleted]}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.textOnPrimary} />
                </View>
              ) : step.current ? (
                <View style={[styles.node, styles.nodeCurrent]}>
                  <View style={styles.nodeCurrentInner} />
                </View>
              ) : (
                <View style={[styles.node, styles.nodePending]}>
                  <View style={styles.nodePendingInner} />
                </View>
              )}
              {!isLast ? (
                <View style={[styles.railLine, step.done && styles.railLineCompleted]} />
              ) : null}
            </View>
            <View style={styles.timelineBody}>
              <Text
                style={[
                  styles.timelineStep,
                  step.done && styles.timelineStepCompleted,
                  step.current && styles.timelineStepCurrent,
                  !step.done && !step.current && styles.timelineStepPending,
                ]}
              >
                {t(step.labelKey)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  statusLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  jobMeta: {
    marginTop: theme.spacing.md,
  },
  cropName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  quantity: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
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
  sectionTitleInline: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
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
  errorText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  statusActions: {
    marginTop: theme.spacing.sm,
  },
  statusActionsLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: theme.spacing.md,
  },
  statusButton: {
    marginBottom: theme.spacing.sm,
  },
  cancelStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  cancelStatusText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.error,
  },
  viewOnly: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  reviewHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.md,
  },
  starRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.sm,
  },
  reviewSubmit: {
    marginTop: theme.spacing.sm,
  },
  reviewSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  reviewSuccessText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.semibold,
    flex: 1,
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
  timelineCancelled: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
});
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import {
  getTransportRequest,
  getTransportQuotes,
  acceptTransportQuote,
  rejectTransportQuote,
  createCounterOffer,
  getNegotiationHistory,
} from '../services/transportService';
import { quoteStatusLabel, quoteStatusTone, offerTypeLabel } from '../utils/transportStatus';
import { rankTransportQuotes } from '../utils/transportQuotes';
import { validateTransportQuote } from '../utils/transportValidation';
import { formatCurrency, formatQuantity, formatDistance, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import { useTranslation } from '../i18n';

export default function TransportQuoteComparisonScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const requestId = route.params?.requestId;

  const [request, setRequest] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyQuoteId, setBusyQuoteId] = useState(null);

  const [counterTarget, setCounterTarget] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [counterErrors, setCounterErrors] = useState({});
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [counterSuccess, setCounterSuccess] = useState(false);
  const [counterNewAnchor, setCounterNewAnchor] = useState(null);

  const [historyOffer, setHistoryOffer] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const openCounter = (quote) => {
    setCounterTarget(quote);
    setCounterAmount('');
    setCounterNotes('');
    setCounterErrors({});
    setCounterSuccess(false);
    setCounterNewAnchor(null);
  };

  const closeCounter = () => {
    if (counterSubmitting) return;
    setCounterTarget(null);
  };

  const submitCounter = async () => {
    const nextErrors = validateTransportQuote({ quotedAmount: counterAmount }, t);
    setCounterErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setCounterSubmitting(true);
    try {
      const result = await createCounterOffer(counterTarget.id, {
        quotedAmount: Number(counterAmount),
        notes: counterNotes,
      });
      const newOffer = result && result.offer ? result.offer : counterTarget;
      setCounterSuccess(true);
      setCounterNewAnchor(newOffer);
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('transport.couldNotSendCounter'));
    } finally {
      setCounterSubmitting(false);
    }
  };

  const viewNegotiation = () => {
    const anchor = counterNewAnchor || counterTarget;
    setCounterTarget(null);
    if (anchor) openHistory(anchor);
  };

  const openHistory = (offer) => {
    setHistoryOffer(offer);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    getNegotiationHistory(offer.id)
      .then((items) => {
        setHistory(Array.isArray(items) ? items : []);
        setHistoryLoading(false);
      })
      .catch((e) => {
        setHistoryError(e.message || t('transport.couldNotLoadHistory'));
        setHistoryLoading(false);
      });
  };

  const closeHistory = () => {
    if (historyLoading) return;
    setHistoryOffer(null);
  };

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getTransportRequest(requestId), getTransportQuotes(requestId)])
      .then(([requestData, quoteList]) => {
        if (cancelled) return;
        setRequest(requestData);
        setQuotes(Array.isArray(quoteList) ? quoteList : []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadQuotes'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestId, t]);

  useEffect(() => {
    return load();
  }, [load]);

  const handleAccept = (quote) => {
    Alert.alert(
      t('transport.confirmAcceptTitle'),
      t('transport.confirmAcceptMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('transport.acceptOffer'),
          style: 'default',
          onPress: async () => {
            setBusyQuoteId(quote.id);
            try {
              const result = await acceptTransportQuote(quote.id);
              const jobId = result && result.job ? result.job.id : null;
              if (jobId) {
                navigation.replace('TransportJob', { jobId });
              } else {
                navigation.goBack();
              }
            } catch (e) {
              setBusyQuoteId(null);
              Alert.alert(t('common.error'), e.message || t('transport.couldNotAccept'));
            }
          },
        },
      ]
    );
  };

  const handleReject = (quote) => {
    Alert.alert(
      t('transport.confirmRejectTitle'),
      t('transport.confirmRejectMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('transport.rejectOffer'),
          style: 'destructive',
          onPress: async () => {
            setBusyQuoteId(quote.id);
            try {
              await rejectTransportQuote(quote.id);
              const remaining = await getTransportQuotes(requestId);
              setQuotes(Array.isArray(remaining) ? remaining : []);
            } catch (e) {
              Alert.alert(t('common.error'), e.message || t('transport.couldNotReject'));
            } finally {
              setBusyQuoteId(null);
            }
          },
        },
      ]
    );
  };

  const renderQuote = ({ item }) => {
    const isSubmitted = item.status === 'SUBMITTED';
    const requesterAuthored = (Number(item.negotiationRound) || 1) % 2 === 0;
    const canCounter = isSubmitted && !requesterAuthored;
    const busy = busyQuoteId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.transporterBlock}>
            <Text style={styles.transporterName}>{item.transporterName}</Text>
            <Text style={styles.transporterMeta}>
              {item.vehicleType}
              {item.distanceKm != null ? ` · ${formatDistance(item.distanceKm)}` : ''}
            </Text>
          </View>
          <Badge label={quoteStatusLabel(item.status, t)} type={quoteStatusTone(item.status)} />
        </View>

        <View style={styles.cardBody}>
          {item.isBest ? (
            <View style={styles.bestPill}>
              <Ionicons name="trophy" size={12} color={theme.colors.success} />
              <Text style={styles.bestPillText}>{t('transport.bestOffer')}</Text>
            </View>
          ) : null}
          <Text style={styles.amount}>{formatCurrency(item.quotedAmount)}</Text>
          {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        </View>

        {isSubmitted ? (
          <View style={styles.cardActions}>
            <PrimaryButton
              title={t('transport.acceptOffer')}
              onPress={() => handleAccept(item)}
              loading={busy}
              disabled={busyQuoteId !== null}
              style={styles.acceptButton}
            />
            <Pressable
              style={[styles.rejectButton, busyQuoteId !== null && styles.disabled]}
              onPress={() => handleReject(item)}
              disabled={busyQuoteId !== null}
            >
              <Text style={styles.rejectText}>{t('transport.rejectOffer')}</Text>
            </Pressable>
            {canCounter ? (
              <Pressable
                style={[styles.counterButton, busyQuoteId !== null && styles.disabled]}
                onPress={() => openCounter(item)}
                disabled={busyQuoteId !== null}
              >
                <Ionicons name="swap-horizontal" size={16} color={theme.colors.primary} />
                <Text style={styles.counterText}>{t('transport.counterOffer')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.compareOffers')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.compareOffers')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransportQuotes')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  const requestNote = request
    ? `${request.cropName} · ${formatQuantity(request.quantity, request.unit)} · ${request.pickupLocation} → ${request.dropLocation}`
    : '';

  const ranked = rankTransportQuotes(quotes);
  const currentSubmittedOffer = ranked.find((q) => q.status === 'SUBMITTED') || null;

  return (
    <View style={styles.screen}>
      <Header title={t('transport.compareOffers')} showBack onBack={() => navigation.goBack()} />
      <FlatList
        data={ranked}
        keyExtractor={(item) => item.id}
        renderItem={renderQuote}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {requestNote ? <Text style={styles.requestNote}>{requestNote}</Text> : null}
            {currentSubmittedOffer ? (
              <Pressable
                style={({ pressed }) => [styles.historyButton, pressed && styles.cardPressed]}
                onPress={() => openHistory(currentSubmittedOffer)}
              >
                <Ionicons name="git-branch-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.historyButtonText}>{t('transport.negotiationHistory')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="pricetag-outline"
            title={t('emptyStates.noTransportOffers')}
            message={t('emptyStates.noTransportOffersHint')}
          />
        }
      />

      <Modal
        visible={!!counterTarget}
        transparent
        animationType="slide"
        onRequestClose={closeCounter}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('transport.counterOfferTitle')}</Text>
              <Pressable onPress={closeCounter} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            {counterSuccess ? (
              <View style={styles.modalSuccess}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={32} color={theme.colors.textOnPrimary} />
                </View>
                <Text style={styles.successTitle}>{t('transport.counterSent')}</Text>
                <Text style={styles.successSubtitle}>{t('transport.counterSentHint')}</Text>
                <PrimaryButton
                  title={t('transport.negotiationHistory')}
                  onPress={viewNegotiation}
                  style={styles.modalPrimaryButton}
                />
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <Text style={styles.modalHint}>{t('transport.counterOfferHint')}</Text>
                {counterTarget ? (
                  <View style={styles.modalTargetCard}>
                    <Text style={styles.modalTargetName}>{counterTarget.transporterName}</Text>
                    <Text style={styles.modalTargetMeta}>
                      {t('transport.quotedPrice')}: {formatCurrency(counterTarget.quotedAmount)}
                    </Text>
                  </View>
                ) : null}
                <InputField
                  label={t('transport.quotedAmount')}
                  value={counterAmount}
                  onChangeText={setCounterAmount}
                  placeholder="₹0"
                  keyboardType="numeric"
                  error={counterErrors.quotedAmount}
                />
                <InputField
                  label={t('transport.notes')}
                  value={counterNotes}
                  onChangeText={setCounterNotes}
                  placeholder={t('transport.notesPlaceholder')}
                  multiline
                />
                <PrimaryButton
                  title={counterSubmitting ? t('common.submitting') : t('transport.sendCounter')}
                  onPress={submitCounter}
                  loading={counterSubmitting}
                  disabled={counterSubmitting}
                  style={styles.modalPrimaryButton}
                />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!historyOffer}
        transparent
        animationType="slide"
        onRequestClose={closeHistory}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('transport.negotiationHistory')}</Text>
              <Pressable onPress={closeHistory} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalHint}>{t('transport.negotiationHistoryHint')}</Text>
            {historyLoading ? (
              <View style={styles.modalCentered}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : historyError ? (
              <View style={styles.modalCentered}>
                <Text style={styles.historyError}>{historyError}</Text>
                <PrimaryButton
                  title={t('common.retry')}
                  onPress={() => openHistory(historyOffer)}
                  style={styles.retryButton}
                />
              </View>
            ) : history.length === 0 ? (
              <View style={styles.modalCentered}>
                <EmptyState icon="time-outline" title={t('transport.noNegotiationHistory')} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.historyList}>
                {history.map((item, index) => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={styles.historyRowTop}>
                      <View style={styles.historyAmountBlock}>
                        <Text style={styles.historyAmount}>
                          {formatCurrency(item.quotedAmount)}
                        </Text>
                        <Text style={styles.historySender}>{senderLabel(item, t)}</Text>
                      </View>
                      <View style={styles.historyBadges}>
                        <Badge label={offerTypeLabel(item.offerType, t)} type="info" />
                        <Badge label={quoteStatusLabel(item.status, t)} type={quoteStatusTone(item.status)} />
                      </View>
                    </View>
                    {item.notes ? <Text style={styles.historyNotes}>{item.notes}</Text> : null}
                    <Text style={styles.historyDate}>
                      {item.createdAt ? formatDate(item.createdAt) : ''}
                      {index === 0 ? ` · ${t('transport.currentOffer')}` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function senderLabel(offer, t) {
  const round = Number(offer.negotiationRound) || 1;
  return round % 2 === 1 ? offer.transporterName : t('transport.you');
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
  requestNote: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  transporterBlock: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  transporterName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  transporterMeta: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  cardBody: {
    marginTop: theme.spacing.md,
  },
  bestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.badgeSuccess,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xxs + 2,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  bestPillText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  amount: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  notes: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  cardActions: {
    marginTop: theme.spacing.lg,
  },
  acceptButton: {
    alignSelf: 'stretch',
  },
  rejectButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.spacing.radiusMedium,
  },
  disabled: {
    opacity: 0.5,
  },
  rejectText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
  },
  counterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.spacing.radiusMedium,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  counterText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
  },
  cardPressed: {
    opacity: 0.85,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  historyButtonText: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.spacing.radiusLarge,
    borderTopRightRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  modalHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  modalTargetCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xxs,
  },
  modalTargetName: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  modalTargetMeta: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  modalPrimaryButton: {
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
  },
  modalSuccess: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  modalCentered: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  historyList: {
    maxHeight: '70%',
  },
  historyRow: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  historyAmountBlock: {
    flexShrink: 1,
    gap: theme.spacing.xxs,
  },
  historyAmount: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  historySender: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  historyBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  historyNotes: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  historyDate: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  historyError: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
});
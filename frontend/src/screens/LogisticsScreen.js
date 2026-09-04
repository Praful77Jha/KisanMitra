import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { UNITS } from '../constants';
import { TRANSPORT_MODES } from '../utils/logistics';
import { estimateLogisticsApi, fetchProducts, fetchOrderById } from '../services/productService';
import {
  fetchLogistics,
  initLogistics,
  updateLogisticsStatus,
} from '../services/logisticsService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatting';
import Header from '../components/Header';
import InputField from '../components/InputField';
import SegmentedControl from '../components/SegmentedControl';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

// Allowed next statuses for the order-logistics lifecycle, used to render the
// buyer's advance controls. Matches the backend transition rules.
const NEXT_STATUSES = {
  pending: ['pickup', 'cancelled'],
  pickup: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const STATUS_ICON = {
  pending: 'time-outline',
  pickup: 'cube-outline',
  in_transit: 'car-outline',
  delivered: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

export default function LogisticsScreen() {
  const { t } = useTranslation();
  const route = useRoute();

  if (route.params && route.params.orderId) {
    return <OrderLogisticsView orderId={route.params.orderId} />;
  }
  return <EstimateView />;
}

// ---- Order-level logistics / delivery status (Phase 3) ----
function OrderLogisticsView({ orderId }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();

  const [logistics, setLogistics] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([fetchLogistics(orderId), fetchOrderById(orderId)])
      .then(([logi, ord]) => {
        if (cancelled) return;
        setLogistics(logi);
        setOrder(ord);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('logistics.couldNotLoad'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId, t]);

  const lastFocus = React.useRef(0);
  React.useEffect(() => {
    if (isFocused) {
      const since = Date.now();
      if (since - lastFocus.current > 400) {
        lastFocus.current = since;
        return load();
      }
    }
    return undefined;
  }, [isFocused, load]);

  const isBuyer = !!order && order.userId === user?.id;

  const handleInit = async () => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const record = await initLogistics(orderId);
      setLogistics(record);
    } catch (e) {
      setActionError(e.message || t('logistics.couldNotInit'));
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async (status) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const record = await updateLogisticsStatus(orderId, status);
      setLogistics(record);
    } catch (e) {
      setActionError(e.message || t('logistics.transitionInvalid'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('logistics.orderTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('logistics.orderTitle')} showBack onBack={() => navigation.goBack()} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadLogistics')}
          message={error}
        />
        <View style={styles.retryWrap}>
          <PrimaryButton title={t('common.retry')} onPress={load} />
        </View>
      </View>
    );
  }

  const nextOptions = NEXT_STATUSES[logistics ? logistics.status : 'pending'] || [];

  return (
    <View style={styles.screen}>
      <Header title={t('logistics.orderTitle')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.orderContent} showsVerticalScrollIndicator={false}>
        {order ? (
          <View style={styles.orderCard}>
            <Text style={styles.orderIdLabel}>{t('logistics.orderReference')}</Text>
            <Text style={styles.orderId}>{order.id}</Text>
            <View style={styles.orderDivider} />
            <InfoRow label={t('logistics.product')} value={order.productName} />
            <InfoRow label={t('logistics.deliveryAddress')} value={order.deliveryAddress} />
            {order.sellerName ? (
              <InfoRow label={t('logistics.seller')} value={order.sellerName} />
            ) : null}
          </View>
        ) : null}

        {!logistics ? (
          <EmptyState
            icon="cube-outline"
            title={t('emptyStates.noLogistics')}
            message={t('emptyStates.noLogisticsHint')}
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('logistics.currentStatus')}</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Ionicons
                  name={STATUS_ICON[logistics.status] || 'time-outline'}
                  size={22}
                  color={theme.colors.primary}
                />
                <Text style={styles.statusText}>{statusLabel(logistics.status, t)}</Text>
              </View>
              <View style={styles.orderDivider} />
              <InfoRow label={t('logistics.createdAt')} value={logistics.createdAt || '—'} />
              <InfoRow label={t('logistics.updatedAt')} value={logistics.updatedAt || '—'} />
            </View>

            <Text style={styles.sectionTitle}>{t('logistics.timeline')}</Text>
            <View style={styles.timelineCard}>
              <LogisticsTimeline status={logistics.status} t={t} />
            </View>

            {isBuyer && nextOptions.length > 0 ? (
              <View style={styles.actions}>
                <Text style={styles.actionsLabel}>{t('logistics.advanceStatus')}</Text>
                {nextOptions.map((status) => (
                  <PrimaryButton
                    key={status}
                    title={statusLabel(status, t)}
                    onPress={() => handleAdvance(status)}
                    loading={busy}
                    disabled={busy}
                    variant={status === 'cancelled' ? 'outline' : 'primary'}
                    style={styles.actionButton}
                  />
                ))}
              </View>
            ) : !isBuyer ? (
              <Text style={styles.viewOnly}>{t('logistics.viewOnly')}</Text>
            ) : null}

            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          </>
        )}

        {!logistics && isBuyer ? (
          <PrimaryButton
            title={t('logistics.init')}
            onPress={handleInit}
            loading={busy}
            disabled={busy}
            style={styles.initButton}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function statusLabel(status, t) {
  switch (status) {
    case 'pickup':
      return t('logistics.statusPickup');
    case 'in_transit':
      return t('logistics.statusInTransit');
    case 'delivered':
      return t('logistics.statusDelivered');
    case 'cancelled':
      return t('logistics.statusCancelled');
    default:
      return t('logistics.statusPending');
  }
}

function LogisticsTimeline({ status, t }) {
  const steps = ['pending', 'pickup', 'in_transit', 'delivered'];
  const currentIndex = steps.indexOf(status);
  const cancelled = status === 'cancelled';
  return (
    <View>
      {steps.map((step, index) => {
        const done = currentIndex > index;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;
        return (
          <View key={step} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              {done ? (
                <View style={[styles.node, styles.nodeCompleted]}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.textOnPrimary} />
                </View>
              ) : isCurrent && !cancelled ? (
                <View style={[styles.node, styles.nodeCurrent]}>
                  <View style={styles.nodeCurrentInner} />
                </View>
              ) : (
                <View style={[styles.node, styles.nodePending]}>
                  <View style={styles.nodePendingInner} />
                </View>
              )}
              {!isLast ? (
                <View style={[styles.railLine, done && styles.railLineCompleted]} />
              ) : null}
            </View>
            <View style={styles.timelineBody}>
              <Text
                style={[
                  styles.timelineStep,
                  done && styles.timelineStepCompleted,
                  isCurrent && !cancelled && styles.timelineStepCurrent,
                  cancelled && styles.timelineStepCancelled,
                ]}
              >
                {statusLabel(step, t)}
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
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ---- Existing demo freight estimate (kept intact, reached without an order) ----
function EstimateView() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const [product, setProduct] = useState('');
  const [distance, setDistance] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS.QUINTAL.label);
  const [modeKey, setModeKey] = useState(TRANSPORT_MODES[0].key);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const loadSuggestions = useCallback(() => {
    let cancelled = false;
    fetchProducts()
      .then((data) => {
        if (!cancelled) {
          setSuggestions([...new Set(data.map((p) => p.name))].slice(0, 4));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    return loadSuggestions();
  }, [loadSuggestions]);

  const validate = () => {
    const nextErrors = {};
    const dist = Number(distance);
    if (!distance.trim()) nextErrors.distance = t('validation.distanceRequired');
    else if (!Number.isFinite(dist) || dist <= 0) nextErrors.distance = t('validation.distanceInvalid');
    const qty = Number(quantity);
    if (!quantity.trim()) nextErrors.quantity = t('validation.quantityRequired');
    else if (!Number.isFinite(qty) || qty <= 0) nextErrors.quantity = t('validation.quantityInvalid');
    return nextErrors;
  };

  const handleEstimate = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      setRequestError('');
      return;
    }
    setEstimating(true);
    setRequestError('');
    try {
      const estimate = await estimateLogisticsApi({
        distanceKm: Number(distance),
        quantity: Number(quantity),
        modeKey,
      });
      setResult(estimate);
    } catch (e) {
      setRequestError(e.message || t('errors.couldNotEstimateLogistics'));
    } finally {
      setEstimating(false);
    }
  };

  const handleReset = () => {
    setDistance('');
    setQuantity('');
    setErrors({});
    setResult(null);
    setRequestError('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={t('logistics.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>{t('logistics.estimateTransport')}</Text>
        <Text style={styles.subheading}>{t('logistics.estimateSubtitle')}</Text>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
          <Text style={styles.noticeText}>{t('logistics.demoEstimateOnly')}</Text>
        </View>

        <InputField
          label={t('logistics.cropProductOptional')}
          value={product}
          onChangeText={setProduct}
          placeholder={t('logistics.cropPlaceholder')}
        />
        <View style={styles.suggestionsRow}>
          {suggestions.map((name) => (
            <View key={name} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{name}</Text>
            </View>
          ))}
        </View>

        <InputField
          label={t('logistics.distanceKm')}
          value={distance}
          onChangeText={setDistance}
          placeholder={t('logistics.distancePlaceholder')}
          keyboardType="numeric"
          error={errors.distance}
        />

        <View style={styles.quantityBlock}>
          <View style={styles.quantityInput}>
            <InputField
              label={t('logistics.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('logistics.quantityPlaceholder')}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
          <View style={styles.unitField}>
            <Text style={styles.fieldLabel}>{t('logistics.unit')}</Text>
            <SegmentedControl
              options={Object.values(UNITS).map((u) => ({ key: u.label, label: u.short }))}
              value={unit}
              onChange={setUnit}
            />
          </View>
        </View>

        <View style={styles.modeField}>
          <Text style={styles.fieldLabel}>{t('logistics.transportMode')}</Text>
          <SegmentedControl
            options={TRANSPORT_MODES.map((m) => ({ key: m.key, label: t(`logistics.transportModes.${m.key}`) }))}
            value={modeKey}
            onChange={setModeKey}
          />
          <Text style={styles.modeHint}>{t('logistics.selectModeHint')}</Text>
        </View>

        <PrimaryButton
          title={estimating ? t('logistics.estimating') : t('logistics.estimate')}
          onPress={handleEstimate}
          disabled={estimating}
          style={styles.estimateButton}
        />

        {requestError ? <Text style={styles.requestError}>{requestError}</Text> : null}

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTitleRow}>
              <Text style={styles.resultTitle}>{t('logistics.estimateResult')}</Text>
              <Text style={styles.resultMode}>{t(`logistics.transportModes.${result.modeKey}`)}</Text>
            </View>

            <ResultRow label={t('logistics.distance')} value={`${result.distanceKm} km`} />
            <ResultRow label={t('logistics.quantityLabel')} value={`${result.quantity} ${unit}`} />
            <ResultRow
              label={t('logistics.freight')}
              value={`${formatCurrency(result.ratePerKm)}/km × ${result.distanceKm} km = ${formatCurrency(result.freight)}`}
            />
            <ResultRow label={t('logistics.loadingUnloading')} value={formatCurrency(result.loading)} />
            <View style={styles.divider} />
            <ResultRow label={t('logistics.totalEstimate')} value={formatCurrency(result.total)} type="net" />

            {unit === UNITS.QUINTAL.label ? (
              <ResultRow label={t('logistics.perQuintal')} value={`${formatCurrency(result.perQuintal)} / qtl`} />
            ) : null}

            <View style={styles.resultNotice}>
              <Ionicons name="information-circle-outline" size={14} color={theme.colors.info} />
              <Text style={styles.resultNoticeText}>{t('logistics.demoEstimateOnly')}</Text>
            </View>

            <PrimaryButton title={t('common.reset')} variant="outline" onPress={handleReset} style={styles.resetButton} />
          </View>
        ) : (
          <View style={styles.footerSpacer} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultRow({ label, value, type = 'neutral' }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, type === 'net' && styles.resultValueNet]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.xl, paddingTop: theme.spacing.lg },
  orderContent: { padding: theme.spacing.xl, paddingTop: theme.spacing.lg },
  heading: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  subheading: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.badgeInfo,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.info,
    lineHeight: 20,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  suggestion: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  quantityBlock: { flexDirection: 'row', gap: theme.spacing.md },
  quantityInput: { flex: 1 },
  unitField: { flex: 1 },
  modeField: { marginBottom: theme.spacing.lg },
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modeHint: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  estimateButton: { marginTop: theme.spacing.sm },
  requestError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  resultTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  resultMode: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  resultLabel: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  resultValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  resultValueNet: { color: theme.colors.success, fontWeight: theme.typography.fontWeights.bold },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
  },
  resultNotice: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.md },
  resultNoticeText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    flexShrink: 1,
    lineHeight: 18,
  },
  resetButton: { marginTop: theme.spacing.lg },
  footerSpacer: { height: theme.spacing.xxl },

  // Order logistics view styles
  retryWrap: { paddingHorizontal: theme.spacing.xl },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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
  orderDivider: {
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
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  statusText: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
  },
  timelineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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
  actions: { marginTop: theme.spacing.md },
  actionsLabel: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  actionButton: { marginBottom: theme.spacing.sm },
  viewOnly: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  actionError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  initButton: { marginTop: theme.spacing.lg },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineRail: { alignItems: 'center', width: 28, marginRight: theme.spacing.md },
  node: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCompleted: { backgroundColor: theme.colors.success },
  nodeCurrent: { backgroundColor: theme.colors.primary },
  nodeCurrentInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textOnPrimary },
  nodePending: { borderWidth: 2, borderColor: theme.colors.textMuted, borderRadius: 12 },
  nodePendingInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textMuted },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xxs,
  },
  railLineCompleted: { backgroundColor: theme.colors.success },
  timelineBody: { flex: 1, paddingBottom: theme.spacing.lg },
  timelineStep: { fontSize: theme.typography.fontSizes.md, fontWeight: theme.typography.fontWeights.medium },
  timelineStepCompleted: { color: theme.colors.textPrimary },
  timelineStepCurrent: { color: theme.colors.primary, fontWeight: theme.typography.fontWeights.bold },
  timelineStepCancelled: { color: theme.colors.error },
});

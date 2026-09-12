import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  getTransportRequest,
  getTransportJobs,
  getTransportQuotes,
  deleteTransportRequest,
} from '../services/transportService';
import { isTransporter } from '../utils/transportRole';
import {
  requestStatusLabel,
  requestStatusTone,
} from '../utils/transportStatus';
import { formatCurrency, formatQuantity, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function TransportRequestDetailsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const requestId = route.params?.requestId;
  const { role } = useAuth();
  const transporter = isTransporter(role);

  const [request, setRequest] = useState(null);
  const [job, setJob] = useState(null);
  const [quoteCount, setQuoteCount] = useState(0);
  const [acceptedQuote, setAcceptedQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getTransportRequest(requestId),
      getTransportJobs()
        .then((jobs) => {
          const match = (jobs || []).find((j) => j.transportRequestId === requestId);
          return match ? match : null;
        })
        .catch(() => null),
      transporter
        ? Promise.resolve(null)
        : getTransportQuotes(requestId).catch(() => null),
    ])
      .then(([data, matchedJob, quotes]) => {
        if (cancelled) return;
        setRequest(data);
        setJob(matchedJob);
        if (Array.isArray(quotes)) {
          setQuoteCount(quotes.filter((q) => q.status === 'SUBMITTED').length);
          setAcceptedQuote(
            quotes.find((q) => q.status === 'ACCEPTED') || null
          );
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadRequest'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestId, transporter, t]);

  useEffect(() => {
    return load();
  }, [load]);

  const handleDelete = () => {
    Alert.alert(
      t('transport.confirmDeleteTitle'),
      t('transport.confirmDeleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('transport.deleteRequest'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteTransportRequest(requestId);
              navigation.goBack();
            } catch (e) {
              setDeleting(false);
              Alert.alert(t('common.error'), e.message || t('transport.couldNotDelete'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.requestTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.requestTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransportRequest')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.requestTitle')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="car-outline"
            title={t('emptyStates.noTransportRequests')}
            message={t('emptyStates.noTransportRequestsHint')}
          />
        </View>
      </View>
    );
  }

  const canDelete = !transporter && request.status === 'OPEN' && !job && quoteCount === 0;

  return (
    <View style={styles.screen}>
      <Header title={t('transport.requestTitle')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cropName}>{request.cropName}</Text>
            <Badge label={requestStatusLabel(request.status, t)} type={requestStatusTone(request.status)} />
          </View>
          <View style={styles.divider} />
          <InfoRow label={t('transport.quantity')} value={formatQuantity(request.quantity, request.unit)} />
          <InfoRow label={t('transport.pickup')} value={request.pickupLocation} />
          <InfoRow label={t('transport.drop')} value={request.dropLocation} />
          {request.requiredBy ? (
            <InfoRow label={t('transport.requiredBy')} value={formatDate(request.requiredBy)} />
          ) : null}
          {request.vehicleType ? (
            <InfoRow label={t('transport.vehicleType')} value={request.vehicleType} />
          ) : null}
          {request.notes ? (
            <InfoRow label={t('transport.notes')} value={request.notes} />
          ) : null}
          {request.orderId ? (
            <InfoRow label={t('transport.linkedOrder')} value={request.orderId} />
          ) : null}
        </View>

        {transporter ? (
          <View style={styles.actions}>
            {request.status === 'OPEN' ? (
              <PrimaryButton
                title={t('transport.sendOffer')}
                onPress={() =>
                  navigation.navigate('SendTransportQuote', { requestId: request.id })
                }
              />
            ) : null}
            {job ? (
              <PrimaryButton
                title={t('transport.viewJob')}
                variant="secondary"
                onPress={() => navigation.navigate('TransportJob', { jobId: job.id })}
                style={styles.actionSecondary}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.actions}>
            {request.status === 'OPEN' ? (
              <>
                <PrimaryButton
                  title={t('transport.viewOffers')}
                  onPress={() =>
                    navigation.navigate('TransportQuoteComparison', { requestId: request.id })
                  }
                />
                <Text style={styles.offersHint}>
                  {quoteCount > 0
                    ? t('transport.offersWaiting', { count: quoteCount })
                    : t('transport.noOffersYetHint')}
                </Text>
              </>
            ) : job ? (
              <PrimaryButton
                title={t('transport.viewJob')}
                onPress={() => navigation.navigate('TransportJob', { jobId: job.id })}
              />
            ) : null}
          </View>
        )}

        {acceptedQuote ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('transport.acceptedOffer')}</Text>
            <View style={styles.divider} />
            <InfoRow label={t('transport.transporter')} value={acceptedQuote.transporterName} />
            <InfoRow label={t('transport.quotedPrice')} value={formatCurrency(acceptedQuote.quotedAmount)} />
            <InfoRow label={t('transport.vehicleType')} value={acceptedQuote.vehicleType} />
          </View>
        ) : null}

        {!transporter && !job && request.status === 'OPEN' ? (
          <Pressable
            style={({ pressed }) => [styles.deleteButton, pressed && styles.cardPressed]}
            onPress={canDelete ? handleDelete : undefined}
            disabled={!canDelete || deleting}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={styles.deleteText}>
              {deleting ? t('common.deleting') : t('transport.deleteRequest')}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cropName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
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
  actions: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionSecondary: {
    marginTop: theme.spacing.sm,
  },
  offersHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.lg,
  },
  deleteText: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.error,
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
});
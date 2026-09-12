import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  getMyTransportRequests,
  getTransportQuotes,
} from '../services/transportService';
import { isRequesterRole } from '../utils/transportRole';
import {
  requestStatusLabel,
  requestStatusTone,
} from '../utils/transportStatus';
import { formatQuantity, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function MyTransportRequestsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { role } = useAuth();
  const requester = isRequesterRole(role);

  const [requests, setRequests] = useState([]);
  const [offersByRequest, setOffersByRequest] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastFocus = React.useRef(0);

  const countOffers = useCallback(
    (reqId) => {
      if (!requester) return Promise.resolve();
      return getTransportQuotes(reqId)
        .then((quotes) =>
          setOffersByRequest((prev) => ({
            ...prev,
            [reqId]: (quotes || []).filter((q) => q.status === 'SUBMITTED').length,
          }))
        )
        .catch(() => {});
    },
    [requester]
  );

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    return getMyTransportRequests()
      .then((data) => {
        if (cancelled) return;
        setRequests(data || []);
        (data || []).forEach((req) => countOffers(req.id));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadRequests'));
        setLoading(false);
      });
  }, [countOffers, t]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    getMyTransportRequests()
      .then((data) => {
        setRequests(data || []);
        (data || []).forEach((req) => countOffers(req.id));
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [countOffers]);

  React.useEffect(() => {
    if (isFocused) {
      const since = Date.now();
      if (since - lastFocus.current > 400) {
        lastFocus.current = since;
        load();
      }
    }
    return undefined;
  }, [isFocused, load]);

  const openRequest = (request) => {
    navigation.navigate('TransportRequestDetails', { requestId: request.id });
  };

  const renderRequest = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => openRequest(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cropName} numberOfLines={1}>
            {item.cropName}
          </Text>
          <Text style={styles.quantity}>
            {formatQuantity(item.quantity, item.unit)}
          </Text>
        </View>
        <Badge label={requestStatusLabel(item.status, t)} type={requestStatusTone(item.status)} />
      </View>

      <View style={styles.routeRow}>
        <Ionicons name="arrow-up-circle-outline" size={14} color={theme.colors.textSecondary} />
        <Text style={styles.routeText} numberOfLines={1}>{item.pickupLocation}</Text>
      </View>
      <View style={styles.routeRow}>
        <Ionicons name="arrow-down-circle-outline" size={14} color={theme.colors.textSecondary} />
        <Text style={styles.routeText} numberOfLines={1}>{item.dropLocation}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {item.requiredBy ? t('transport.byDate', { date: formatDate(item.requiredBy) }) : t('transport.noDeadline')}
        </Text>
        {requester && offersByRequest[item.id] > 0 ? (
          <Text style={styles.offerCount}>
            {t('transport.offerCount', { count: offersByRequest[item.id] })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('transport.myRequests')}
        showBack
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransport')}
            message={error}
          />
          <PrimaryButton
            title={t('common.retry')}
            onPress={load}
            style={styles.retryButton}
          />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary]} />
          }
          ListHeaderComponent={
            requester ? (
              <PrimaryButton
                title={t('transport.newRequest')}
                onPress={() => navigation.navigate('TransportRequestForm')}
                style={styles.newButton}
              />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="car-outline"
              title={t('emptyStates.noTransportRequests')}
              message={t('emptyStates.noTransportRequestsHint')}
            />
          }
        />
      )}
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
  newButton: {
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
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
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
  offerCount: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});
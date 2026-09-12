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
import { getAvailableTransportRequests } from '../services/transportService';
import { formatQuantity, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function AvailableTransportRequestsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastFocus = React.useRef(0);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    return getAvailableTransportRequests()
      .then((data) => {
        if (!cancelled) {
          setRequests(data || []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('transport.couldNotLoadRequests'));
          setLoading(false);
        }
      });
  }, [t]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    getAvailableTransportRequests()
      .then((data) => setRequests(data || []))
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

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

  const renderRequest = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() =>
        navigation.navigate('TransportRequestDetails', { requestId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cropName} numberOfLines={1}>{item.cropName}</Text>
          <Text style={styles.quantity}>{formatQuantity(item.quantity, item.unit)}</Text>
        </View>
        {item.vehicleType ? (
          <View style={styles.vehiclePill}>
            <Ionicons name="car-outline" size={12} color={theme.colors.primary} />
            <Text style={styles.vehiclePillText}>{item.vehicleType}</Text>
          </View>
        ) : null}
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
          {item.requiredBy
            ? t('transport.neededBy', { date: formatDate(item.requiredBy) })
            : t('transport.noDeadline')}
        </Text>
        <Text style={styles.offerLink}>{t('transport.sendOffer')}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('transport.availableJobs')}
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
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
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
          ListEmptyComponent={
            <EmptyState
              icon="map-outline"
              title={t('emptyStates.noAvailableTransportRequests')}
              message={t('emptyStates.noAvailableTransportRequestsHint')}
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
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xxs + 2,
    paddingHorizontal: theme.spacing.sm,
  },
  vehiclePillText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
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
  offerLink: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});
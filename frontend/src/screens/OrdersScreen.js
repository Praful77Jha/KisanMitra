import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import theme from '../theme';
import { useTranslation } from '../i18n';
import { fetchOrders } from '../services/productService';
import { formatCurrency, formatQuantity, formatDateShort } from '../utils/formatting';
import { translateOrderStatus } from '../utils/statusLabels';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';

function statusType(status) {
  if (status === 'Delivered') return 'success';
  return 'info';
}

export default function OrdersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchOrders()
        .then((data) => {
          if (!cancelled) {
            setOrders(data);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message || t('errors.couldNotLoadOrders'));
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }, [])
  );

  const openOrder = (orderId) => {
    navigation.navigate('OrderDetails', { orderId });
  };

  const renderItem = ({ item }) => (
    <Pressable onPress={() => openOrder(item.id)} style={({ pressed }) => pressed && styles.cardPressed}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName}>{item.productName}</Text>
          <Badge label={translateOrderStatus(item.status, t)} type={statusType(item.status)} />
        </View>

        <View style={styles.metaRow}>
          <Meta label={t('orders.quantity')} value={formatQuantity(item.quantity, item.unit)} />
          <Meta label={t('orders.seller')} value={item.sellerName} />
          <Meta label={t('orders.total')} value={formatCurrency(item.totalAmount)} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>{formatDateShort(item.orderDate)}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.md }]}>
        <Text style={styles.title}>{t('orders.myOrders')}</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : error ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('emptyStates.couldNotLoadOrders')}
              message={error}
            />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title={t('emptyStates.noOrdersYet')}
              message={t('emptyStates.noOrdersHint')}
            />
          )
        }
      />
    </View>
  );
}

function Meta({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
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
    marginBottom: theme.spacing.lg,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  productName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
  },
  metaItem: {
    width: '33.33%',
    marginBottom: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  metaLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.md,
  },
  orderId: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  orderDate: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
  },
});

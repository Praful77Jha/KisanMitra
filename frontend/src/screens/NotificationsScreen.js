import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import { formatDateShort } from '../utils/formatting';
import { useTranslation } from '../i18n';

const TYPE_ICON = {
  offer: 'pricetag-outline',
  order: 'receipt-outline',
  review: 'star-outline',
  transport_quote: 'car-outline',
  transport_quote_accepted: 'checkmark-circle-outline',
  transport_status: 'car-outline',
  transport_delivered: 'checkmark-done',
  transport_review: 'star-outline',
};

function NotificationIcon({ type, unread }) {
  const icon = TYPE_ICON[type] || 'notifications-outline';
  return (
    <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
      <Ionicons
        name={icon}
        size={20}
        color={unread ? theme.colors.primary : theme.colors.textMuted}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchNotifications()
      .then((data) => {
        if (cancelled) return;
        setNotifications(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('notifications.couldNotLoad'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [t]);

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

  const handlePress = async (item) => {
    if (!item.read) {
      const optimistic = notifications.map((n) =>
        n.id === item.id ? { ...n, read: true } : n
      );
      setNotifications(optimistic);
      markNotificationRead(item.id).catch(() => {});
    }
    if (item.refType === 'order' && item.refId) {
      navigation.navigate('OrderDetails', { orderId: item.refId });
    }
    if (
      item.refType === 'transportRequest' &&
      item.refId
    ) {
      navigation.navigate('TransportRequestDetails', { requestId: item.refId });
    }
    if (
      item.refType === 'transportJob' &&
      item.refId
    ) {
      navigation.navigate('TransportJob', { jobId: item.refId });
    }
  };

  const handleMarkAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const unread = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        !item.read && styles.cardUnread,
      ]}
      onPress={() => handlePress(item)}
    >
      <NotificationIcon type={item.type} unread={!item.read} />
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text
            style={[styles.title, !item.read && styles.titleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.time}>
          {item.createdAt ? formatDateShort(item.createdAt) : ''}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('notifications.title')}
        showBack
        onBack={() => navigation.goBack()}
        rightIcon="checkmark-done"
        onRightPress={handleMarkAll}
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadNotifications')}
          message={error}
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            unread > 0 ? (
              <Text style={styles.listHint}>
                {t('notifications.unreadPrefix')} {unread} {t('notifications.unreadSuffix')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title={t('emptyStates.noNotifications')}
              message={t('emptyStates.noNotificationsHint')}
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
  listContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  listHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardUnread: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryTint,
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  iconWrapUnread: {
    backgroundColor: theme.colors.primaryTint,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    flexShrink: 1,
    marginRight: theme.spacing.xs,
  },
  titleUnread: {
    color: theme.colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  body: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xxs,
  },
  time: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});

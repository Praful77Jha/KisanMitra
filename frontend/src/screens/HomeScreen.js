import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../theme';
import { mockCategories, mockQuickActions } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../services/productService';
import { fetchUnreadCount } from '../services/notificationService';
import SearchBar from '../components/SearchBar';
import CategoryChip from '../components/CategoryChip';
import QuickAction from '../components/QuickAction';
import ProductCard from '../components/ProductCard';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import LocationPickerModal from '../components/LocationPickerModal';
import { useTranslation } from '../i18n';

const QUICK_ACTION_COLORS = [
  theme.colors.primary,
  theme.colors.accent,
  theme.colors.success,
  theme.colors.info,
  theme.colors.secondary,
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, updateLocation } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [locationOpen, setLocationOpen] = useState(false);
  const isFocused = useIsFocused();

  const loadUnreadCount = useCallback(() => {
    let cancelled = false;
    fetchUnreadCount()
      .then((count) => {
        if (!cancelled) setNotificationsUnread(count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isFocused) return loadUnreadCount();
    return undefined;
  }, [isFocused, loadUnreadCount]);

  const loadProducts = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchProducts()
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadProducts'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return loadProducts();
  }, [loadProducts]);

  const bestDeals = useMemo(
    () => [...products].sort((a, b) => b.dealScore - a.dealScore).slice(0, 4),
    [products]
  );

  const handleSearch = (text) => {
    setSearch(text);
  };

  const submitSearch = () => {
    navigation.navigate('Marketplace', { query: search.trim() });
  };

  const navigateToProduct = (product) => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  const handleQuickAction = (action) => {
    if (action.key === 'sell_crop') {
      navigation.navigate('SellCrop');
    }
    if (action.key === 'all_products') {
      navigation.navigate('Marketplace');
    }
    if (action.key === 'buyer_req') {
      navigation.navigate('MyRequirements');
    }
    if (action.key === 'compare') {
      navigation.navigate('CompareDeals');
    }
    if (action.key === 'logistics') {
      navigation.navigate('Logistics');
    }
    if (action.key === 'prices') {
      navigation.navigate('PriceInsights');
    }
    if (action.key === 'market_prices') {
      navigation.navigate('MarketComparison');
    }
    if (action.key === 'where_to_sell') {
      navigation.navigate('SmartRecommendation');
    }
    if (action.key === 'seller_needs') {
      navigation.navigate('AvailableNeeds');
    }
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category.key);
    navigation.navigate('Marketplace', { category: category.label });
  };

  const openNotifications = () => {
    setNotificationsUnread(0);
    navigation.navigate('Notifications');
  };

  const handleLocationConfirm = (location) => {
    return updateLocation(location);
  };

  const heroIllustration = Math.min(width * 0.4, 170);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.sm }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.topBar}>
          <Pressable style={styles.locationChip} onPress={() => setLocationOpen(true)}>
            <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {user?.location || t('home.selectLocation')}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable style={styles.iconButton} onPress={openNotifications} hitSlop={6}>
              <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
              {notificationsUnread > 0 && <View style={styles.notificationDot} />}
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => {}}>
              <Text style={styles.avatarText}>
                {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || ''}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <MaterialCommunityIcons
            name="tractor-variant"
            size={heroIllustration}
            style={styles.heroIllustration}
            color={theme.colors.primaryDark}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="leaf" size={13} color={theme.colors.primary} />
            <Text style={styles.heroBadgeText}>{t('home.getBetterDeals')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('home.heroSubtitle')}
          </Text>
          <View style={styles.heroButtons}>
            <PrimaryButton
              title={t('home.sellCrop')}
              onPress={() => navigation.navigate('SellCrop')}
              style={styles.heroButton}
            />
            <PrimaryButton
              title={t('home.postRequirement')}
              variant="secondary"
              onPress={() => navigation.navigate('Post')}
              style={styles.heroButton}
            />
          </View>
        </View>

        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={handleSearch}
            onSubmitEditing={submitSearch}
            placeholder={t('home.searchCrops')}
            onFilterPress={() => navigation.navigate('Marketplace')}
          />
        </View>

        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <View style={styles.quickActions}>
          {mockQuickActions.map((action, index) => {
            const labelKey = {
              sell_crop: 'quickActions.sellCrop',
              all_products: 'quickActions.allProducts',
              buyer_req: 'quickActions.myRequirements',
              compare: 'quickActions.compareDeals',
              logistics: 'quickActions.logisticsEstimate',
              prices: 'quickActions.priceInsights',
              market_prices: 'quickActions.marketComparison',
              where_to_sell: 'quickActions.smartRecommendation',
              seller_needs: 'quickActions.respondToNeeds',
            }[action.key];
            return (
              <QuickAction
                key={action.key}
                icon={action.icon}
                label={labelKey ? t(labelKey) : action.label}
                color={QUICK_ACTION_COLORS[index % QUICK_ACTION_COLORS.length]}
                onPress={() => handleQuickAction(action)}
              />
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('home.topCategories')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {mockCategories.map((category) => (
            <CategoryChip
              key={category.key}
              label={t(`categories.${category.key}`)}
              icon={category.icon}
              active={activeCategory === category.key}
              onPress={() => handleCategoryChange(category)}
            />
          ))}
        </ScrollView>

        <View style={styles.dealsHeader}>
          <Text style={styles.sectionTitle}>{t('home.bestDealsNearYou')}</Text>
          <Pressable onPress={() => navigation.navigate('Marketplace')} hitSlop={6}>
            <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.dealsState}>
            <EmptyState
              icon="alert-circle-outline"
              title={t('emptyStates.couldNotLoadProducts')}
              message={error}
            />
            <PrimaryButton
              title={t('common.retry')}
              onPress={loadProducts}
              style={styles.retryButton}
            />
          </View>
        ) : loading && bestDeals.length === 0 ? (
          <View style={styles.dealsState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          bestDeals.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => navigateToProduct(product)}
              onFavouritePress={() => {}}
            />
          ))
        )}
        <View style={styles.footerSpacer} />
      </ScrollView>
      <LocationPickerModal
        visible={locationOpen}
        initialValue={user?.location}
        onClose={() => setLocationOpen(false)}
        onConfirm={handleLocationConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: '68%',
    gap: theme.spacing.xs,
  },
  locationText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.medium,
    flexShrink: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.bold,
    fontSize: theme.typography.fontSizes.md,
  },
  hero: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.radiusLarge,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    minHeight: 220,
  },
  heroIllustration: {
    position: 'absolute',
    right: -20,
    bottom: -16,
    opacity: 0.16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  heroBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  heroTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textOnPrimary,
    maxWidth: '78%',
    marginBottom: theme.spacing.xs,
    lineHeight: 24,
  },
  heroSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textOnPrimary,
    opacity: 0.92,
    maxWidth: '72%',
    marginBottom: theme.spacing.lg,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  heroButton: {
    flex: 1,
  },
  searchRow: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoriesRow: {
    paddingRight: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  dealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
    fontSize: theme.typography.fontSizes.md,
  },
  dealsState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  footerSpacer: {
    height: theme.spacing.xl,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../services/productService';
import { CROP_CATEGORIES } from '../constants';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import CategoryChip from '../components/CategoryChip';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function MarketplaceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const initialCategory = route.params?.category || null;
  const initialQuery = route.params?.query || '';

  const SORT_OPTIONS = [
    { key: 'score', label: t('marketplace.bestDeal') },
    { key: 'priceLow', label: t('marketplace.priceLow') },
    { key: 'priceHigh', label: t('marketplace.priceHigh') },
    { key: 'nearest', label: t('marketplace.nearest') },
  ];

  const [search, setSearch] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeSort, setActiveSort] = useState('score');
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const categories = CROP_CATEGORIES;

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (activeCategory) {
      list = list.filter(
        (p) => p.category.toLowerCase() === activeCategory.toLowerCase()
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.seller.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    switch (activeSort) {
      case 'priceLow':
        list.sort((a, b) => a.pricePerQuintal - b.pricePerQuintal);
        break;
      case 'priceHigh':
        list.sort((a, b) => b.pricePerQuintal - a.pricePerQuintal);
        break;
      case 'nearest':
        list.sort((a, b) => a.distanceKm - b.distanceKm);
        break;
      default:
        list.sort((a, b) => b.dealScore - a.dealScore);
        break;
    }

    return list;
  }, [products, activeCategory, search, activeSort]);

  const toggleCategory = (category) => {
    setActiveCategory((current) =>
      current === category ? null : category
    );
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const renderItem = ({ item }) => (
    <ProductCard
      product={item}
      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      onFavouritePress={() => {}}
    />
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.md }]}>
        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('marketplace.title')}</Text>
        <Pressable style={styles.locationChip} onPress={() => {}}>
          <Ionicons name="location-outline" size={15} color={theme.colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {(user?.location || '').split(',')[0]}
          </Text>
          <Ionicons name="chevron-down" size={13} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('marketplace.searchProducts')}
          onFilterPress={() => setShowFilters((v) => !v)}
        />
        <Text style={styles.label}>{t('marketplace.sortBy')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {SORT_OPTIONS.map((option) => (
            <CategoryChip
              key={option.key}
              label={option.label}
              active={activeSort === option.key}
              onPress={() => setActiveSort(option.key)}
            />
          ))}
        </ScrollView>
      </View>

      {showFilters ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {categories.map((category) => (
            <CategoryChip
              key={category.key}
              label={t(`categories.${category.key}`)}
              active={activeCategory === category.label}
              onPress={() => toggleCategory(category.label)}
            />
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.listState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.listState}>
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
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('emptyStates.noProductsFound')}
              message={t('emptyStates.tryChangingFilters')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  locationText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
    maxWidth: 78,
  },
  controls: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.medium,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  sortRow: {
    paddingRight: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingRight: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  listState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
});

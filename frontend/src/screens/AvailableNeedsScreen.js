import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchAvailableRequirements } from '../services/productService';
import { formatCurrency } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function AvailableNeedsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAvailableRequirements()
      .then((data) => {
        if (cancelled) return;
        setRequirements(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('errors.couldNotLoadAvailableRequirements'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  };

  useEffect(() => {
    return load();
  }, []);

  const renderItem = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() =>
        navigation.navigate('MakeOffer', { requirementId: item.id, requirement: item })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cropName}>{item.cropName}</Text>
        <Badge label={t('requirements.active')} type="success" />
      </View>

      <View style={styles.metaGrid}>
        <MetaItem label={t('requirements.quantity')} value={`${item.quantity} ${item.unit}`} />
        <MetaItem label={t('requirements.grade')} value={item.grade} />
        <MetaItem label={t('requirements.maxPrice')} value={formatCurrency(item.maxPricePerQuintal)} />
        <MetaItem label={t('requirements.offers')} value={String(item.offerCount ?? 0)} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerText} numberOfLines={1}>
          {item.location}
        </Text>
      </View>

      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>{t('availableNeeds.makeAnOffer')}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Header title={t('availableNeeds.title')} showBack onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadNeeds')}
          message={error}
        />
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.listHint}>
{t('availableNeeds.hint')}
            </Text>
          }
          ListEmptyComponent={
            <EmptyState
              icon="pricetag-outline"
              title={t('emptyStates.noOpenNeeds')}
              message={t('emptyStates.noNeedsHint')}
            />
          }
        />
      )}
    </View>
  );
}

function MetaItem({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
    marginBottom: theme.spacing.lg,
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
    opacity: 0.9,
    borderColor: theme.colors.primary,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xxs,
    marginTop: theme.spacing.sm,
  },
  tapHintText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  cropName: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
  },
  metaItem: {
    width: '50%',
    marginBottom: theme.spacing.sm,
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
    gap: theme.spacing.sm,
  },
  footerText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
});

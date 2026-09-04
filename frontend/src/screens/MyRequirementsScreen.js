import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchRequirements, deleteRequirement } from '../services/productService';
import { formatCurrency, formatDateShort } from '../utils/formatting';
import Header from '../components/Header';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function MyRequirementsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchRequirements()
      .then((data) => {
        if (cancelled) return;
        setRequirements(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('errors.couldNotLoadRequirements'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = (item) => {
    Alert.alert(t('requirements.deleteTitle'), t('requirements.deleteConfirm', { crop: item.cropName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequirement(item.id);
            setRequirements((prev) => prev.filter((r) => r.id !== item.id));
          } catch (e) {
            Alert.alert(t('common.error'), e.message || t('requirements.deleteFailed'));
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={() => navigation.navigate('RequirementOffers', { requirementId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cropName}>{item.cropName}</Text>
        <View style={styles.headerRight}>
          {item.status === 'active' ? (
            <Pressable
              hitSlop={8}
              style={styles.deleteButton}
              onPress={(event) => {
                event.stopPropagation();
                handleDelete(item);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </Pressable>
          ) : null}
          <Badge label={item.status === 'active' ? t('requirements.active') : t('requirements.completed')} type={item.status === 'active' ? 'success' : 'info'} />
        </View>
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
        {item.requiredBy ? (
          <Text style={styles.footerText}>{t('requirements.byDate', { date: formatDateShort(item.requiredBy) })}</Text>
        ) : null}
      </View>

      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>
          {item.status === 'active' ? t('requirements.viewOffers') : t('requirements.viewDetails')}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Header title={t('requirements.myRequirements')} showBack onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('emptyStates.couldNotLoadRequirements')}
          message={error}
        />
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title={t('emptyStates.noRequirementsYet')}
              message={t('emptyStates.postRequirementHint')}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
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

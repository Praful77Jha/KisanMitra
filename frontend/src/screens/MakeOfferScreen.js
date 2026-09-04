import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { fetchRequirementById, createOffer } from '../services/productService';
import { formatCurrency } from '../utils/formatting';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function MakeOfferScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const requirementId = route.params?.requirementId;
  const passedRequirement = route.params?.requirement;
  // Product-based offer mode: a buyer makes an offer on a seller's product
  // listing. In this mode no requirement is involved; the product is passed
  // inline from the product details screen.
  const productId = route.params?.productId;
  const passedProduct = route.params?.product;
  const isProductMode = Boolean(productId);

  const [requirement, setRequirement] = useState(passedRequirement || null);
  const [loading, setLoading] = useState(!passedRequirement && !passedProduct);
  const [error, setError] = useState('');

  const [offerPrice, setOfferPrice] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const loadRequirement = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchRequirementById(requirementId)
      .then((data) => {
        if (!cancelled) {
          setRequirement(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || t('errors.couldNotLoadRequirement'));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [requirementId, t]);

  useEffect(() => {
    if (passedRequirement || passedProduct) {
      setLoading(false);
      return undefined;
    }
    return loadRequirement();
  }, [loadRequirement, passedRequirement, passedProduct]);

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!offerPrice.trim()) {
      nextErrors.offerPrice = t('validation.offerPriceRequired');
    } else {
      const price = Number(offerPrice);
      if (!Number.isFinite(price) || price <= 0) {
        nextErrors.offerPrice = t('validation.offerPriceInvalid');
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      // In product mode the offer is linked to the seller's product listing;
      // otherwise it responds to a buyer requirement. Seller/buyer identity is
      // resolved server-side from the authenticated user.
      const payload = isProductMode
        ? {
            productId,
            quantity: passedProduct.quantity,
            unit: passedProduct.unit,
            offeredPricePerQuintal: Number(offerPrice),
            notes: note.trim() || undefined,
          }
        : {
            requirementId,
            quantity: requirement.quantity,
            unit: requirement.unit,
            offeredPricePerQuintal: Number(offerPrice),
            notes: note.trim() || undefined,
          };
      await createOffer(payload);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || t('errors.couldNotSubmitOffer'));
    } finally {
      setSubmitting(false);
    }
  };

  const backToNeeds = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('makeOffer.title')} showBack onBack={backToNeeds} />
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('makeOffer.title')} showBack onBack={backToNeeds} />
        <View style={styles.empty}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadRequirement')}
            message={error}
          />
          <PrimaryButton
            title={t('common.retry')}
            onPress={loadRequirement}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  if (!isProductMode && !requirement) {
    return (
      <View style={styles.screen}>
        <Header title={t('makeOffer.title')} showBack onBack={backToNeeds} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('makeOffer.requirementNotFound')}</Text>
        </View>
      </View>
    );
  }

  const entityName = isProductMode ? passedProduct.name : requirement.cropName;

  if (submitted) {
    return (
      <View style={styles.screen}>
        <Header title={t('makeOffer.title')} showBack onBack={backToNeeds} />
        <View style={styles.successContainer}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={theme.colors.textOnPrimary} />
          </View>
          <Text style={styles.successTitle}>{t('makeOffer.offerSent')}</Text>
          <Text style={styles.successSubtitle}>
            {isProductMode
              ? t('makeOffer.productOfferSentSubtitle', { product: entityName })
              : t('makeOffer.offerSentSubtitle', { crop: entityName })}
          </Text>
          <PrimaryButton
            title={isProductMode ? t('makeOffer.backToProducts') : t('makeOffer.backToNeeds')}
            onPress={backToNeeds}
            style={styles.backButton}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={t('makeOffer.title')} showBack onBack={backToNeeds} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.requirementCard}>
          <Text style={styles.requirementName}>{entityName}</Text>
          {isProductMode ? (
            <View style={styles.requirementMeta}>
              <Text style={styles.requirementMetaText}>
                {t('makeOffer.sellerLabel')}: {passedProduct.seller}
              </Text>
              <Text style={styles.requirementMetaText}>
                {t('makeOffer.quantityLabel')}: {passedProduct.quantity} {passedProduct.unit} · {passedProduct.location}
              </Text>
              <Text style={styles.referencePrice}>
                {t('makeOffer.sellerAsking')} {formatCurrency(passedProduct.pricePerQuintal)} {t('product.quintal')}
              </Text>
            </View>
          ) : (
            <View style={styles.requirementMeta}>
              <Text style={styles.requirementMetaText}>
                {t('makeOffer.quantityLabel')}: {requirement.quantity} {requirement.unit} · {requirement.location}
              </Text>
              <Text style={styles.referencePrice}>
                {t('makeOffer.buyerExpects')} {formatCurrency(requirement.maxPricePerQuintal)} {t('product.quintal')}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.heading}>{t('makeOffer.makeYourOffer')}</Text>
        <Text style={styles.subheading}>
          {isProductMode ? t('makeOffer.productOfferSubtitle') : t('makeOffer.offerSubtitle')}
        </Text>

        <InputField
          label={t('makeOffer.offerPriceLabel')}
          value={offerPrice}
          onChangeText={setOfferPrice}
          placeholder={t('makeOffer.offerPricePlaceholder')}
          keyboardType="numeric"
          error={errors.offerPrice}
        />

        <InputField
          label={t('makeOffer.noteLabel')}
          value={note}
          onChangeText={setNote}
          placeholder={t('makeOffer.notePlaceholder')}
          multiline
        />

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <PrimaryButton
          title={submitting ? t('makeOffer.submitting') : t('makeOffer.submitOffer')}
          onPress={handleSubmit}
          disabled={submitting}
          style={styles.submitButton}
        />
        <View style={styles.footerSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  requirementCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  requirementName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  requirementMeta: {
    gap: theme.spacing.xs,
  },
  requirementMetaText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  referencePrice: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
  },
  heading: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  subheading: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  submitButton: {
    marginTop: theme.spacing.lg,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  backButton: {
    marginTop: theme.spacing.xl,
    alignSelf: 'stretch',
  },
});

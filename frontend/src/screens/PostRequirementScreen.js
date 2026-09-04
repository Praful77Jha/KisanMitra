import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import theme from '../theme';
import { UNITS, QUALITY_GRADES, DEFAULT_LOCATION } from '../constants';
import { useAuth } from '../context/AuthContext';
import { addRequirement, fetchProducts } from '../services/productService';
import Header from '../components/Header';
import InputField from '../components/InputField';
import SegmentedControl from '../components/SegmentedControl';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function PostRequirementScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS.QUINTAL.label);
  const [grade, setGrade] = useState(QUALITY_GRADES[0]);
  const [maxPrice, setMaxPrice] = useState('');
  const [location, setLocation] = useState(user?.location || DEFAULT_LOCATION);
  const [requiredBy, setRequiredBy] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const loadSuggestions = useCallback(() => {
    let cancelled = false;
    fetchProducts()
      .then((data) => {
        if (!cancelled) {
          setSuggestions([...new Set(data.map((p) => p.name))]);
        }
      })
      .catch(() => {
        // Suggestions are optional convenience chips; the field is free text.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return loadSuggestions();
  }, [loadSuggestions]);

  const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  };

  const validate = () => {
    const nextErrors = {};

    if (!product.trim()) nextErrors.product = t('validation.productRequired');

    const qty = Number(quantity);
    if (!quantity.trim()) nextErrors.quantity = t('validation.quantityRequired');
    else if (!Number.isFinite(qty) || qty <= 0) nextErrors.quantity = t('validation.quantityInvalid');

    const price = Number(maxPrice);
    if (!maxPrice.trim()) nextErrors.maxPrice = t('validation.maxPriceRequired');
    else if (!Number.isFinite(price) || price <= 0) nextErrors.maxPrice = t('validation.maxPriceInvalid');

    if (!location.trim()) nextErrors.location = t('validation.locationRequired');

    if (!requiredBy.trim()) nextErrors.requiredBy = t('validation.requiredByRequired');
    else if (!isValidDate(requiredBy.trim())) nextErrors.requiredBy = t('validation.dateFormat');

    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await addRequirement({
        cropName: product.trim(),
        grade,
        quantity: Number(quantity),
        unit,
        maxPricePerQuintal: Number(maxPrice),
        location: location.trim(),
        requiredBy: requiredBy.trim(),
        notes: notes.trim(),
      });
      navigation.navigate('MyRequirements');
    } catch (e) {
      setSubmitError(e.message || t('errors.couldNotPostRequirement'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={t('postRequirement.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>{t('postRequirement.whatToBuy')}</Text>
        <Text style={styles.subheading}>
          {t('postRequirement.subtitle')}
        </Text>

        <InputField
          label={t('postRequirement.productCropName')}
          value={product}
          onChangeText={setProduct}
          placeholder={t('postRequirement.productPlaceholder')}
          error={errors.product}
        />
        <View style={styles.suggestionsRow}>
          {suggestions.slice(0, 4).map((name) => (
            <View key={name} style={styles.suggestion}>
              <Text style={styles.suggestionText}>{name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.quantityBlock}>
          <View style={styles.quantityInput}>
            <InputField
              label={t('postRequirement.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('postRequirement.quantityPlaceholder')}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
          <View style={styles.unitField}>
            <Text style={styles.fieldLabel}>{t('postRequirement.unit')}</Text>
            <SegmentedControl
              options={Object.values(UNITS).map((u) => ({ key: u.label, label: u.short }))}
              value={unit}
              onChange={setUnit}
            />
          </View>
        </View>

        <View style={styles.gradeField}>
          <Text style={styles.fieldLabel}>{t('postRequirement.qualityGrade')}</Text>
          <SegmentedControl
            options={QUALITY_GRADES.map((g) => ({ key: g, label: g }))}
            value={grade}
            onChange={setGrade}
          />
        </View>

        <InputField
          label={t('postRequirement.deliveryLocation')}
          value={location}
          onChangeText={setLocation}
          placeholder={t('postRequirement.locationPlaceholder')}
          error={errors.location}
        />

        <InputField
          label={t('postRequirement.maxPrice')}
          value={maxPrice}
          onChangeText={setMaxPrice}
          placeholder={t('postRequirement.maxPricePlaceholder')}
          keyboardType="numeric"
          error={errors.maxPrice}
        />

        <InputField
          label={t('postRequirement.requiredBy')}
          value={requiredBy}
          onChangeText={setRequiredBy}
          placeholder={t('postRequirement.requiredByPlaceholder')}
          error={errors.requiredBy}
        />

        <InputField
          label={t('postRequirement.additionalNotes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('postRequirement.notesPlaceholder')}
          multiline
        />

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <PrimaryButton title={submitting ? t('postRequirement.posting') : t('postRequirement.postButton')} onPress={handleSubmit} disabled={submitting} style={styles.submitButton} />
        <View style={styles.footerSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
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
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  suggestion: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  quantityBlock: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quantityInput: {
    flex: 1,
  },
  unitField: {
    flex: 1,
  },
  gradeField: {
    marginBottom: theme.spacing.lg,
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
});

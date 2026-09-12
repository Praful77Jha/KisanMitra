import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import theme from '../theme';
import { UNITS, QUALITY_GRADES, CROP_CATEGORIES } from '../constants';
import {
  LOCATION_STATES,
  districtsForState,
  villagesForDistrict,
} from '../constants/locations';
import { createProduct, uploadImage } from '../services/productService';
import Header from '../components/Header';
import InputField from '../components/InputField';
import SegmentedControl from '../components/SegmentedControl';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

export default function SellCropScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const voiceCrop = route.params?.crop;

  useEffect(() => {
    if (voiceCrop) setCropName(voiceCrop);
  }, [voiceCrop]);

  const goToMarketplace = () => {
    navigation.navigate('Tabs', { screen: 'Marketplace' });
  };

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState(CROP_CATEGORIES[0].label);
  const [grade, setGrade] = useState(QUALITY_GRADES[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS.QUINTAL.label);
  const [price, setPrice] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [posted, setPosted] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    if (submitting || uploading) return;
    setPhotoError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.4,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      if (!asset.base64) {
        setPhotoError(t('sellCrop.photoUploadFailed'));
        return;
      }
      const ext =
        asset.mimeType === 'image/png'
          ? 'png'
          : asset.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';
      setPhoto({
        uri: asset.uri,
        base64: asset.base64,
        fileName: `crop-${Date.now()}.${ext}`,
      });
    } catch (e) {
      setPhotoError(t('sellCrop.photoUploadFailed'));
    }
  };

  const removePhoto = () => {
    if (submitting || uploading) return;
    setPhoto(null);
    setPhotoError('');
  };

  const pickState = (s) => {
    setState(s);
    setDistrict('');
    setVillage('');
  };
  const pickDistrict = (d) => {
    setDistrict(d);
    setVillage('');
  };

  const locationText = village || district || state
    ? [village, district, state].filter(Boolean).join(', ')
    : '';

  const validate = () => {
    const nextErrors = {};
    if (!cropName.trim()) nextErrors.cropName = t('validation.productRequired');
    const qty = Number(quantity);
    if (!quantity.trim()) nextErrors.quantity = t('validation.quantityRequired');
    else if (!Number.isFinite(qty) || qty <= 0) nextErrors.quantity = t('validation.quantityInvalid');
    const priceNum = Number(price);
    if (!price.trim()) nextErrors.price = t('sellCrop.priceRequired');
    else if (!Number.isFinite(priceNum) || priceNum <= 0) nextErrors.price = t('sellCrop.priceInvalid');
    if (!state || !district) nextErrors.location = t('sellCrop.selectLocation');
    return nextErrors;
  };

  const handleSubmit = async () => {
    // Category/grade/unit are always selected from constants, so no validation needed.
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    let imageUrl = null;
    try {
      if (photo) {
        setUploading(true);
        try {
          imageUrl = await uploadImage({ fileName: photo.fileName, base64: photo.base64 });
        } catch (e) {
          setSubmitError(t('sellCrop.photoUploadFailed'));
          setUploading(false);
          setSubmitting(false);
          return;
        }
        setUploading(false);
      }
      await createProduct({
        name: cropName.trim(),
        category,
        grade,
        quantity: Number(quantity),
        unit,
        pricePerQuintal: Number(price),
        location: locationText,
        description: description.trim(),
        imageUrl,
      });
      setPosted(true);
    } catch (e) {
      setSubmitError(e.message || t('sellCrop.cannotPost'));
    } finally {
      setSubmitting(false);
    }
  };

  if (posted) {
    return (
      <View style={styles.flex}>
        <Header title={t('sellCrop.title')} showBack onBack={goToMarketplace} />
        <View style={styles.successWrap}>
          <View style={styles.successCard}>
            <View style={styles.successBadge}>
              <Text style={styles.successIconText}>🌾</Text>
            </View>
            <Text style={styles.successTitle}>{t('sellCrop.successTitle')}</Text>
            <Text style={styles.successSubtitle}>{t('sellCrop.successSubtitle')}</Text>
            <PrimaryButton
              title={t('sellCrop.viewMarketplace')}
              onPress={goToMarketplace}
              style={styles.successButton}
            />
          </View>
        </View>
      </View>
    );
  }

  const districts = districtsForState(state);
  const villages = villagesForDistrict(state, district);

  const renderChips = (options, selected, onSelect, emptyText) => (
    <View style={styles.chipWrap}>
      {options.length === 0 ? (
        <Text style={styles.chipEmpty}>{emptyText}</Text>
      ) : (
        options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={t('sellCrop.title')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>{t('sellCrop.whatToSell')}</Text>
        <Text style={styles.subheading}>
          {t('sellCrop.subtitle')}
        </Text>

        <InputField
          label={t('sellCrop.cropName')}
          value={cropName}
          onChangeText={setCropName}
          placeholder={t('sellCrop.cropPlaceholder')}
          error={errors.cropName}
        />

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('sellCrop.category')}</Text>
          <SegmentedControl
            options={CROP_CATEGORIES.map((c) => ({ key: c.label, label: t(`categories.${c.key}`) }))}
            value={category}
            onChange={setCategory}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('sellCrop.grade')}</Text>
          <SegmentedControl
            options={QUALITY_GRADES.map((g) => ({ key: g, label: g }))}
            value={grade}
            onChange={setGrade}
          />
        </View>

        <View style={styles.quantityBlock}>
          <View style={styles.quantityInput}>
            <InputField
              label={t('sellCrop.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('sellCrop.quantityPlaceholder')}
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
          <View style={styles.unitField}>
            <Text style={styles.fieldLabel}>{t('sellCrop.unit')}</Text>
            <SegmentedControl
              options={Object.values(UNITS).map((u) => ({ key: u.label, label: u.short }))}
              value={unit}
              onChange={setUnit}
            />
          </View>
        </View>

        <InputField
          label={t('sellCrop.askingPrice')}
          value={price}
          onChangeText={setPrice}
          placeholder={t('sellCrop.pricePlaceholder')}
          keyboardType="numeric"
          error={errors.price}
        />

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('sellCrop.location')}</Text>
          <Text style={styles.locationHint}>{t('sellCrop.selectState')}</Text>
          {renderChips(LOCATION_STATES, state, pickState, t('sellCrop.locationHint'))}
          {state ? (
            <>
              <Text style={styles.locationHint}>{t('sellCrop.selectDistrict')}</Text>
              {renderChips(districts, district, pickDistrict, t('sellCrop.invalidState'))}
            </>
          ) : null}
          {state && district ? (
            <>
              <Text style={styles.locationHint}>{t('sellCrop.selectVillage')}</Text>
              {renderChips(villages, village, setVillage, t('sellCrop.invalidDistrict'))}
            </>
          ) : null}
          {locationText ? (
            <Text style={styles.selectedLocation}>{locationText}</Text>
          ) : null}
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
        </View>

        <InputField
          label={t('sellCrop.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('sellCrop.descriptionPlaceholder')}
          multiline
        />

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('sellCrop.addPhoto')}</Text>
          {photo ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover" />
              <Text style={styles.photoSelected}>{t('sellCrop.photoSelected')}</Text>
              <View style={styles.photoActions}>
                <Pressable
                  style={styles.photoAction}
                  onPress={pickPhoto}
                  disabled={submitting || uploading}
                >
                  <Text style={styles.photoActionText}>{t('sellCrop.changePhoto')}</Text>
                </Pressable>
                <Pressable
                  style={styles.photoAction}
                  onPress={removePhoto}
                  disabled={submitting || uploading}
                >
                  <Text style={styles.photoActionRemove}>{t('sellCrop.removePhoto')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.photoPicker, uploading && styles.photoPickerDisabled]}
              onPress={pickPhoto}
              disabled={submitting || uploading}
            >
              {uploading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={26} color={theme.colors.primary} />
                  <Text style={styles.photoPickerText}>{t('sellCrop.pickPhoto')}</Text>
                </>
              )}
            </Pressable>
          )}
          {uploading ? (
            <Text style={styles.photoHint}>{t('sellCrop.uploadingPhoto')}</Text>
          ) : null}
          {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
        </View>

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <PrimaryButton
          title={submitting ? t('sellCrop.posting') : t('sellCrop.postButton')}
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
  fieldBlock: {
    marginBottom: theme.spacing.lg,
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
  locationHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  chipEmpty: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  selectedLocation: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    marginTop: theme.spacing.lg,
  },
  photoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusLarge,
    paddingVertical: theme.spacing.lg,
  },
  photoPickerDisabled: {
    opacity: 0.5,
  },
  photoPickerText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  photoPreviewWrap: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: theme.spacing.radiusLarge,
    backgroundColor: theme.colors.surfaceAlt,
  },
  photoSelected: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeights.medium,
    marginTop: theme.spacing.sm,
  },
  photoActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  photoAction: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  photoActionText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  photoActionRemove: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    fontWeight: theme.typography.fontWeights.medium,
  },
  photoHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
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
  successWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primaryTint,
    borderWidth: 2,
    borderColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successIconText: {
    fontSize: 44,
  },
  successTitle: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  successSubtitle: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  successButton: {
    alignSelf: 'stretch',
  },
});

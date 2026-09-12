import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import {
  getMyTransporterProfile,
  createTransporterProfile,
  updateMyTransporterProfile,
  getTransportJobHistory,
} from '../services/transportService';
import { VEHICLE_TYPES } from '../constants/transport';
import { isTransporter } from '../utils/transportRole';
import { validateTransporterProfile } from '../utils/transportValidation';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import LocationPickerModal from '../components/LocationPickerModal';
import { useTranslation } from '../i18n';

export default function TransporterProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { role } = useAuth();

  const [phase, setPhase] = useState('loading'); // loading | missing | ready
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [baseLocation, setBaseLocation] = useState('');
  const [description, setDescription] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saved, setSaved] = useState(false);

  const [completedCount, setCompletedCount] = useState(null);

  const load = useCallback(() => {
    if (!isTransporter(role)) {
      setPhase('ready');
      return;
    }
    let cancelled = false;
    setLoadError('');
    getMyTransporterProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setVehicleTypes(
          (data.vehicleTypes || '').split(',').map((v) => v.trim()).filter(Boolean)
        );
        setBaseLocation(data.baseLocation || '');
        setDescription(data.description || '');
        setPhase('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.message && /transporter profile not found/i.test(e.message)) {
          setProfile(null);
          setVehicleTypes([]);
          setBaseLocation('');
          setDescription('');
          setPhase('missing');
        } else {
          setLoadError(e.message || t('transport.couldNotLoadProfile'));
          setPhase('missing');
        }
      });
    if (!cancelled) {
      getTransportJobHistory()
        .then((jobs) => {
          if (!cancelled) setCompletedCount((jobs || []).length);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [role, t]);

  useEffect(() => {
    return load();
  }, [load]);

  const toggleVehicle = (vehicle) => {
    setSaved(false);
    setVehicleTypes((prev) =>
      prev.includes(vehicle) ? prev.filter((v) => v !== vehicle) : [...prev, vehicle]
    );
  };

  const handleSave = async () => {
    const nextErrors = validateTransporterProfile(
      { vehicleTypes: vehicleTypes.join(', '), baseLocation },
      t
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      vehicleTypes: vehicleTypes.join(', '),
      baseLocation: baseLocation.trim(),
      description: description.trim() || undefined,
    };

    setSubmitting(true);
    setSubmitError('');
    try {
      const savedProfile = profile
        ? await updateMyTransporterProfile(payload)
        : await createTransporterProfile(payload);
      setProfile(savedProfile);
      setPhase('ready');
      setSaved(true);
    } catch (e) {
      setSubmitError(e.message || t('transport.couldNotSaveProfile'));
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <View style={styles.screen}>
        <Header
          title={t('transport.profile')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!isTransporter(role)) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('transport.profile')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <EmptyState
            icon="lock-closed-outline"
            title={t('transport.requesterOnly')}
            message={t('transport.transporterOnlyHint')}
          />
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('transport.profile')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransporterProfile')}
            message={loadError}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={t('transport.profile')}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!profile ? (
          <View style={styles.emptyProfile}>
            <Ionicons name="car-outline" size={40} color={theme.colors.primary} />
            <Text style={styles.emptyProfileTitle}>{t('transport.noProfile')}</Text>
            <Text style={styles.emptyProfileHint}>{t('transport.createProfileHint')}</Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          {profile && profile.avgRating != null ? (
            <View style={styles.statCard}>
              <Ionicons name="star" size={18} color={theme.colors.warning} />
              <Text style={styles.statValue}>{profile.avgRating} / 5</Text>
              <Text style={styles.statLabel}>{t('transport.rating')}</Text>
            </View>
          ) : null}
          {completedCount != null ? (
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>{t('transport.completedJobCount')}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.fieldLabel}>{t('transport.vehicleTypes')}</Text>
        <View style={styles.chipWrap}>
          {VEHICLE_TYPES.map((vehicle) => {
            const active = vehicleTypes.includes(vehicle);
            return (
              <Pressable
                key={vehicle}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleVehicle(vehicle)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {vehicle}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.vehicleTypes ? (
          <Text style={styles.fieldError}>{errors.vehicleTypes}</Text>
        ) : null}

        <Text style={styles.fieldLabel}>{t('transport.baseLocation')}</Text>
        <Pressable
          style={[styles.locationField, errors.baseLocation ? styles.locationFieldError : null]}
          onPress={() => setLocationOpen(true)}
        >
          {baseLocation ? (
            <Text style={styles.locationFieldText}>{baseLocation}</Text>
          ) : (
            <Text style={styles.locationFieldPlaceholder}>{t('transport.baseLocationPlaceholder')}</Text>
          )}
          <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
        </Pressable>
        {errors.baseLocation ? (
          <Text style={styles.fieldError}>{errors.baseLocation}</Text>
        ) : null}

        <InputField
          label={t('transport.description')}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            setSaved(false);
          }}
          placeholder={t('transport.descriptionPlaceholder')}
          multiline
        />

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <PrimaryButton
          title={
            submitting
              ? t('common.submitting')
              : profile
                ? t('transport.saveProfile')
                : t('transport.createProfileAction')
          }
          onPress={handleSave}
          loading={submitting}
          disabled={submitting}
          style={styles.saveButton}
        />

        {saved ? (
          <Text style={styles.savedText}>{t('transport.profileSaved')}</Text>
        ) : null}

        <View style={styles.footerSpacer} />
      </ScrollView>

      <LocationPickerModal
        visible={locationOpen}
        initialValue={baseLocation}
        onClose={() => setLocationOpen(false)}
        onConfirm={(location) => {
          setBaseLocation(location);
          return Promise.resolve();
        }}
      />
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
  emptyProfile: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyProfileTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptyProfileHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  statValue: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  fieldError: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
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
  locationField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  locationFieldError: {
    borderColor: theme.colors.error,
  },
  locationFieldText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  locationFieldPlaceholder: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textMuted,
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: theme.spacing.xl,
  },
  savedText: {
    color: theme.colors.success,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
});
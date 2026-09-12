import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import {
  getTransportRequest,
  getMyTransporterProfile,
  createTransportQuote,
} from '../services/transportService';
import { isTransporter } from '../utils/transportRole';
import { useAuth } from '../context/AuthContext';
import { validateTransportQuote } from '../utils/transportValidation';
import { formatQuantity, formatDate } from '../utils/formatting';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
import { useTranslation } from '../i18n';

export default function SendTransportQuoteScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const requestId = route.params?.requestId;
  const { role } = useAuth();

  const [request, setRequest] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [quotedAmount, setQuotedAmount] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getTransportRequest(requestId),
      getMyTransporterProfile().catch(() => null),
    ])
      .then(([requestData, profileData]) => {
        if (cancelled) return;
        setRequest(requestData);
        setProfile(profileData);
        const vehicles = profileData
          ? String(profileData.vehicleTypes || '').split(',').map((v) => v.trim()).filter(Boolean)
          : [];
        const requestVehicle = requestData && requestData.vehicleType ? requestData.vehicleType : null;
        const fixed = requestVehicle && vehicles.includes(requestVehicle) ? requestVehicle : null;
        setSelectedVehicle(fixed || vehicles[0] || '');
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadRequest'));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [requestId, t]);

  useEffect(() => {
    return load();
  }, [load]);

  if (!isTransporter(role)) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.sendOffer')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.deniedText}>{t('transport.transporterOnlyHint')}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.sendOffer')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.sendOffer')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransportRequest')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  const handleSubmit = async () => {
    const nextErrors = validateTransportQuote(
      { quotedAmount, vehicleType: selectedVehicle },
      t,
      { requireVehicleType: true },
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await createTransportQuote(requestId, {
        quotedAmount: Number(quotedAmount),
        vehicleType: selectedVehicle,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || t('transport.couldNotSendOffer'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.screen}>
        <Header title={t('transport.sendOffer')} showBack onBack={() => navigation.goBack()} />
        <View style={styles.successContainer}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={theme.colors.textOnPrimary} />
          </View>
          <Text style={styles.successTitle}>{t('transport.offerSent')}</Text>
          <Text style={styles.successSubtitle}>{t('transport.offerSentHint')}</Text>
          <PrimaryButton
            title={t('transport.backToRequest')}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </View>
      </View>
    );
  }

  const profileVehicles = profile
    ? String(profile.vehicleTypes || '').split(',').map((v) => v.trim()).filter(Boolean)
    : [];
  const requestVehicle = request && request.vehicleType ? request.vehicleType : null;
  const noVehicles = profileVehicles.length === 0;
  const incompatible =
    !!requestVehicle && profileVehicles.length > 0 && !profileVehicles.includes(requestVehicle);
  const fixedVehicle =
    requestVehicle && profileVehicles.includes(requestVehicle) ? requestVehicle : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title={t('transport.sendOffer')} showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.requestCard}>
          <Text style={styles.requestName}>{request.cropName}</Text>
          <Text style={styles.requestMeta}>
            {formatQuantity(request.quantity, request.unit)}
          </Text>
          <Text style={styles.requestRoute}>
            {request.pickupLocation} → {request.dropLocation}
          </Text>
          {request.requiredBy ? (
            <Text style={styles.requestRoute}>
              {t('transport.neededBy', { date: formatDate(request.requiredBy) })}
            </Text>
          ) : null}
          {request.vehicleType ? (
            <Text style={styles.requestRoute}>
              {t('transport.vehicleType')}: {request.vehicleType}
            </Text>
          ) : null}
        </View>

        {noVehicles ? (
          <View style={styles.blockNotice}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.blockNoticeText}>
              {t('validation.profileVehiclesRequired')}
            </Text>
          </View>
        ) : incompatible ? (
          <View style={styles.blockNotice}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warning} />
            <Text style={styles.blockNoticeText}>
              {t('validation.vehicleIncompatible', { vehicle: requestVehicle })}
            </Text>
          </View>
        ) : fixedVehicle || profileVehicles.length === 1 ? (
          <View style={styles.vehicleRow}>
            <Text style={styles.fieldLabel}>{t('transport.vehicleType')}</Text>
            <View style={styles.vehiclePill}>
              <Ionicons name="car-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.vehiclePillText}>{selectedVehicle}</Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.fieldLabel}>{t('transport.vehicleType')}</Text>
            <Text style={styles.fieldHint}>{t('transport.vehicleTypeHint')}</Text>
            <View style={styles.chipWrap}>
              {profileVehicles.map((vehicle) => {
                const active = vehicle === selectedVehicle;
                const disabled = fixedVehicle !== null && vehicle !== fixedVehicle;
                return (
                  <Pressable
                    key={vehicle}
                    disabled={disabled}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      disabled && styles.chipDisabled,
                    ]}
                    onPress={() => setSelectedVehicle(active ? '' : vehicle)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {vehicle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.vehicleType ? (
              <Text style={styles.fieldError}>{errors.vehicleType}</Text>
            ) : null}
          </View>
        )}

        <InputField
          label={t('transport.quotedAmount')}
          value={quotedAmount}
          onChangeText={setQuotedAmount}
          placeholder="₹0"
          keyboardType="numeric"
          error={errors.quotedAmount}
        />

        <InputField
          label={t('transport.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('transport.notesPlaceholder')}
          multiline
        />

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <PrimaryButton
          title={submitting ? t('common.submitting') : t('transport.submitOffer')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || noVehicles || incompatible}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  deniedText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  requestCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.radiusLarge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  requestName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
  },
  requestMeta: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  requestRoute: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
  },
  blockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.badgeWarning,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  blockNoticeText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  vehicleRow: {
    marginBottom: theme.spacing.lg,
  },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  vehiclePillText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  fieldHint: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  fieldError: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
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
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.textOnPrimary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: theme.spacing.xl,
  },
  footerSpacer: {
    height: theme.spacing.xxl,
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
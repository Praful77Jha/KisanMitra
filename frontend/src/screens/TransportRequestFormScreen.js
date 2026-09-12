import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import { createTransportRequest } from '../services/transportService';
import { UNITS } from '../constants';
import { VEHICLE_TYPES } from '../constants/transport';
import { isRequesterRole } from '../utils/transportRole';
import { validateTransportRequest } from '../utils/transportValidation';
import Header from '../components/Header';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import LocationPickerModal from '../components/LocationPickerModal';
import { useTranslation } from '../i18n';

const UNIT_OPTIONS = Object.values(UNITS).map((unit) => ({
  key: unit.value,
  label: unit.label,
}));

export default function TransportRequestFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const orderId = route.params?.orderId;
  const { role } = useAuth();

  const [cropName, setCropName] = useState(route.params?.cropName || '');
  const [quantity, setQuantity] = useState(
    route.params?.quantity != null ? String(route.params.quantity) : ''
  );
  const [unit, setUnit] = useState(route.params?.unit || UNITS.KILOGRAM.value);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  if (!isRequesterRole(role)) {
    return (
      <View style={styles.screen}>
        <Header
          title={t('transport.newRequest')}
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.deniedText}>{t('transport.requesterOnly')}</Text>
        </View>
      </View>
    );
  }

  const handleSubmit = async () => {
    const nextErrors = validateTransportRequest(
      { cropName, quantity, unit, pickupLocation, dropLocation, requiredBy },
      t,
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await createTransportRequest({
        cropName: cropName.trim(),
        quantity: Number(quantity),
        unit,
        pickupLocation: pickupLocation.trim(),
        dropLocation: dropLocation.trim(),
        requiredBy: requiredBy.trim() || undefined,
        vehicleType: vehicleType || undefined,
        notes: notes.trim() || undefined,
        orderId: orderId || undefined,
      });
      navigation.replace('TransportRequestDetails', { requestId: created.id });
    } catch (e) {
      setSubmitError(e.message || t('transport.couldNotCreateRequest'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={t('transport.newRequest')}
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
        {orderId ? (
          <View style={styles.orderHint}>
            <Ionicons name="receipt-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.orderHintText}>{t('transport.orderLinkedHint')}</Text>
          </View>
        ) : null}

        <InputField
          label={t('transport.crop')}
          value={cropName}
          onChangeText={setCropName}
          placeholder={t('transport.cropPlaceholder')}
          error={errors.cropName}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <InputField
              label={t('transport.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              keyboardType="numeric"
              error={errors.quantity}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.fieldLabel}>{t('transport.unit')}</Text>
            <View style={styles.chipWrap}>
              {UNIT_OPTIONS.map((option) => {
                const active = option.key === unit;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setUnit(option.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.fieldLabel}>{t('transport.pickup')}</Text>
        <LocationField
          value={pickupLocation}
          placeholder={t('transport.pickupPlaceholder')}
          error={errors.pickupLocation}
          onPress={() => setPickupOpen(true)}
        />

        <Text style={styles.fieldLabel}>{t('transport.drop')}</Text>
        <LocationField
          value={dropLocation}
          placeholder={t('transport.dropPlaceholder')}
          error={errors.dropLocation}
          onPress={() => setDropOpen(true)}
        />

        <InputField
          label={t('transport.requiredBy')}
          value={requiredBy}
          onChangeText={setRequiredBy}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={errors.requiredBy}
        />

        <Text style={styles.fieldLabel}>{t('transport.vehicleType')}</Text>
        <Text style={styles.fieldHint}>{t('transport.vehicleTypeHint')}</Text>
        <View style={styles.chipWrap}>
          {VEHICLE_TYPES.map((vehicle) => {
            const active = vehicle === vehicleType;
            return (
              <Pressable
                key={vehicle}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setVehicleType(active ? '' : vehicle)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {vehicle}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <InputField
          label={t('transport.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('transport.notesPlaceholder')}
          multiline
        />

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <PrimaryButton
          title={submitting ? t('common.submitting') : t('transport.submitRequest')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitButton}
        />
        <View style={styles.footerSpacer} />
      </ScrollView>

      <LocationPickerModal
        visible={pickupOpen}
        initialValue={pickupLocation}
        onClose={() => setPickupOpen(false)}
        onConfirm={(location) => {
          setPickupLocation(location);
          return Promise.resolve();
        }}
      />
      <LocationPickerModal
        visible={dropOpen}
        initialValue={dropLocation}
        onClose={() => setDropOpen(false)}
        onConfirm={(location) => {
          setDropLocation(location);
          return Promise.resolve();
        }}
      />
    </KeyboardAvoidingView>
  );
}

function LocationField({ value, placeholder, error, onPress }) {
  return (
    <>
      <Pressable
        style={[styles.locationField, error ? styles.locationFieldError : null]}
        onPress={onPress}
      >
        {value ? (
          <Text style={styles.locationFieldText}>{value}</Text>
        ) : (
          <Text style={styles.locationFieldPlaceholder}>{placeholder}</Text>
        )}
        <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </>
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
  orderHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.spacing.radiusMedium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  orderHintText: {
    flex: 1,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  fieldHint: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
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
  },
  submitButton: {
    marginTop: theme.spacing.xl,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  footerSpacer: {
    height: theme.spacing.xxl,
  },
  denied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  deniedText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
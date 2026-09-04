import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import {
  LOCATION_STATES,
  districtsForState,
  villagesForDistrict,
} from '../constants/locations';
import PrimaryButton from './PrimaryButton';
import { useTranslation } from '../i18n';

// Hackathon-safe, deterministic State → District → Village/City location selector.
// Reuses the exact data and flow that powers the "Sell Crop" picker, so there is a
// single source of truth for location options. No GPS, no fake coordinates.
export default function LocationPickerModal({
  visible,
  initialValue,
  onClose,
  onConfirm,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const parts = (initialValue || '').split(',').map((p) => p.trim());
    setState(parts[2] || '');
    setDistrict(parts[1] || '');
    setVillage(parts[0] || '');
  }, [visible, initialValue]);

  const pickState = (s) => {
    setState(s);
    setDistrict('');
    setVillage('');
  };
  const pickDistrict = (d) => {
    setDistrict(d);
    setVillage('');
  };

  const locationText = [village, district, state].filter(Boolean).join(', ');

  const handleApply = async () => {
    if (!state || !district) return;
    setConfirmError('');
    setConfirming(true);
    try {
      await onConfirm(locationText || `${district}, ${state}`);
      onClose();
    } catch (_) {
      setConfirmError(t('locationPicker.saveFailed'));
    } finally {
      setConfirming(false);
    }
  };

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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + theme.spacing.md },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{t('locationPicker.title')}</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>{t('locationPicker.selectState')}</Text>
            {renderChips(LOCATION_STATES, state, pickState, t('locationPicker.noOptions'))}
            {state ? (
              <>
                <Text style={styles.hint}>{t('locationPicker.selectDistrict')}</Text>
                {renderChips(districts, district, pickDistrict, t('locationPicker.noDistricts'))}
              </>
            ) : null}
            {state && district ? (
              <>
                <Text style={styles.hint}>{t('locationPicker.selectVillage')}</Text>
                {renderChips(villages, village, setVillage, t('locationPicker.noVillages'))}
              </>
            ) : null}
            {locationText ? (
              <Text style={styles.selectedLocation}>{locationText}</Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} hitSlop={6}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <View style={styles.applyWrap}>
              <PrimaryButton
                title={t('locationPicker.apply')}
                onPress={handleApply}
                disabled={!state || !district || confirming}
                loading={confirming}
              />
            </View>
          </View>
          {confirmError ? (
            <Text style={styles.confirmError}>{confirmError}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.spacing.radiusLarge,
    borderTopRightRadius: theme.spacing.radiusLarge,
    maxHeight: '82%',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingBottom: theme.spacing.md,
  },
  hint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
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
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  confirmError: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.error,
    textAlign: 'center',
  },
  cancelBtn: {
    paddingVertical: theme.spacing.md,
  },
  cancelText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  applyWrap: {
    flex: 1,
  },
});

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
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import SegmentedControl from '../components/SegmentedControl';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from '../i18n';

const ROLE_OPTIONS = [
  { key: 'FARMER', labelKey: 'roles.farmer' },
  { key: 'BUYER', labelKey: 'roles.buyer' },
  { key: 'TRANSPORTER', labelKey: 'roles.transporter' },
];

export default function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('FARMER');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateAccount = async () => {
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = t('validation.nameRequired');
    if (!phone.trim()) nextErrors.phone = t('validation.phoneRequired');
    if (!password.trim()) nextErrors.password = t('validation.passwordRequired');
    else if (password.length < 6) nextErrors.password = t('validation.passwordMinLength');
    if (confirmPassword !== password) nextErrors.confirmPassword = t('validation.passwordsNoMatch');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError('');
    setSubmitting(true);
    try {
      await register({ name: name.trim(), phone: phone.trim(), password, role });
    } catch (error) {
      setSubmitError(error.message || t('errors.registrationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (key) => {
    navigation.navigate(key === 'login' ? 'Login' : 'Register');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Ionicons name="leaf" size={28} color={theme.colors.primary} />
          <Text style={styles.brandName}>KisanMitra</Text>
        </View>

        <Text style={styles.heading}>{t('auth.createAccount')}</Text>
        <Text style={styles.subheading}>{t('auth.joinSubtitle')}</Text>

        <SegmentedControl
          value="signup"
          options={[
            { key: 'login', label: t('auth.login') },
            { key: 'signup', label: t('auth.signUp') },
          ]}
          onChange={handleTabChange}
        />

        <View style={styles.roleSection}>
          <Text style={styles.roleTitle}>{t('auth.registerAs')}</Text>
          <Text style={styles.roleHint}>{t('auth.registerAsHint')}</Text>
          <SegmentedControl
            value={role}
            options={ROLE_OPTIONS.map((option) => ({
              key: option.key,
              label: t(option.labelKey),
            }))}
            onChange={setRole}
          />
        </View>

        <View style={styles.form}>
          <InputField
            label={t('auth.fullName')}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.enterFullName')}
            error={errors.name}
          />
          <InputField
            label={t('auth.phoneNumber')}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('auth.enterPhone')}
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <InputField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.newPasswordPlaceholder')}
            secureTextEntry
            error={errors.password}
          />
          <InputField
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth.reenterPasswordPlaceholder')}
            secureTextEntry
            error={errors.confirmPassword}
          />

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <PrimaryButton
            title={t('auth.createAccountButton')}
            onPress={handleCreateAccount}
            style={styles.registerButton}
            loading={submitting}
          />
        </View>

        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptText}>{t('auth.alreadyHaveAccount')}</Text>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>{t('auth.signInLink')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.xxxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xxl,
  },
  brandName: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
  },
  heading: {
    fontSize: theme.typography.fontSizes.xxxl,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subheading: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  form: {
    marginTop: theme.spacing.xl,
  },
  roleSection: {
    marginTop: theme.spacing.xl,
  },
  roleTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xxs,
  },
  roleHint: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  registerButton: {
    marginTop: theme.spacing.xs,
  },
  submitError: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSizes.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  loginPromptText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
  },
  loginLink: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.bold,
    fontSize: theme.typography.fontSizes.md,
  },
});

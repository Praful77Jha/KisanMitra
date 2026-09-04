import React, { useEffect, useState } from 'react';
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
import SocialLoginButton from '../components/SocialLoginButton';
import { useTranslation } from '../i18n';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ gestureEnabled: false });
    }
  }, [navigation]);

  const handleLogin = async () => {
    const nextErrors = {};
    if (!phone.trim()) nextErrors.phone = t('validation.phoneRequired');
    if (!password.trim()) nextErrors.password = t('validation.passwordRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError('');
    setSubmitting(true);
    try {
      await login({ phone: phone.trim(), password });
    } catch (error) {
      setSubmitError(error.message || t('errors.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (key) => {
    navigation.navigate(key === 'signup' ? 'Register' : 'Login');
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

        <Text style={styles.heading}>{t('auth.welcomeBack')}</Text>
        <Text style={styles.subheading}>{t('auth.signInSubtitle')}</Text>

        <SegmentedControl
          value="login"
          options={[
            { key: 'login', label: t('auth.login') },
            { key: 'signup', label: t('auth.signUp') },
          ]}
          onChange={handleTabChange}
        />

        <View style={styles.form}>
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
            placeholder={t('auth.enterPassword')}
            secureTextEntry
            error={errors.password}
          />

          <Pressable style={styles.forgotRow} onPress={() => {}}>
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <PrimaryButton
            title={t('auth.loginButton')}
            onPress={handleLogin}
            style={styles.loginButton}
            loading={submitting}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('common.orContinueWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <SocialLoginButton type="google" onPress={() => {}} />
          <SocialLoginButton type="facebook" onPress={() => {}} />
          <SocialLoginButton type="whatsapp" onPress={() => {}} />
        </View>

        <View style={styles.signupPrompt}>
          <Text style={styles.signupPromptText}>{t('auth.newToKisanMitra')}</Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signupLink}>{t('auth.createAccountLink')}</Text>
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg,
  },
  forgotText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.semibold,
    fontSize: theme.typography.fontSizes.sm,
  },
  loginButton: {
    marginTop: theme.spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSizes.sm,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupPromptText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
  },
  signupLink: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeights.bold,
    fontSize: theme.typography.fontSizes.md,
  },
});

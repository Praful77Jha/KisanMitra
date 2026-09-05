import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';
import { useLanguage, useTranslation } from '../i18n';
import { navigationRef } from '../navigation/navigationRef';
import { parseCommand, INTENTS } from '../utils/voiceIntent';
import {
  isRecognitionAvailable,
  requestPermissionsAsync,
  startRecognition,
  stopRecognition,
  cleanup,
} from '../services/voiceService';

const SCREEN_LABEL_KEY = {
  [INTENTS.MARKET_PRICE]: 'marketComparison.title',
  [INTENTS.SMART_SELLING]: 'recommendation.title',
  [INTENTS.SELL_CROP]: 'sellCrop.title',
  [INTENTS.MARKETPLACE]: 'navigation.marketplace',
  [INTENTS.ORDERS]: 'navigation.orders',
  [INTENTS.PROFILE]: 'navigation.profile',
};

function navigateForParsed(parsed) {
  if (!navigationRef.isReady()) return;
  const { intent, crop, quantity } = parsed;
  if (intent === INTENTS.MARKET_PRICE) {
    navigationRef.navigate('Main', { screen: 'MarketComparison', params: { crop } });
  } else if (intent === INTENTS.SMART_SELLING) {
    navigationRef.navigate('Main', { screen: 'SmartRecommendation', params: { crop, quantity } });
  } else if (intent === INTENTS.SELL_CROP) {
    navigationRef.navigate('Main', { screen: 'SellCrop', params: { crop } });
  } else if (intent === INTENTS.MARKETPLACE) {
    navigationRef.navigate('Main', { screen: 'Tabs', params: { screen: 'Marketplace' } });
  } else if (intent === INTENTS.ORDERS) {
    navigationRef.navigate('Main', { screen: 'Tabs', params: { screen: 'Orders' } });
  } else if (intent === INTENTS.PROFILE) {
    navigationRef.navigate('Main', { screen: 'Tabs', params: { screen: 'Profile' } });
  }
}

// Animated expanding ring behind the mic while listening.
function PulseRing() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.15, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulseRing, { opacity, transform: [{ scale }] }]}
    />
  );
}

// Sound-wave equalizer bars while the microphone is live.
function ListeningBars() {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        130,
        bars.map((bar) =>
          Animated.sequence([
            Animated.timing(bar, {
              toValue: 1,
              duration: 330,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: 0.35,
              duration: 330,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, [bars]);
  return (
    <View style={styles.equalizer}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[styles.equalizerBar, { transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
}

export default function VoiceAssistantButton({ style }) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle|checking|listening|processing|result|error
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState(null);
  const [openingLabel, setOpeningLabel] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const dismissedRef = useRef(false);
  const stoppedRef = useRef(false);
  const navTimeoutRef = useRef(null);

  const resetSession = useCallback(() => {
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = null;
    }
    setPhase('idle');
    setInterim('');
    setTranscript('');
    setParsed(null);
    setOpeningLabel('');
    setErrorKey('');
  }, []);

  // Safety cleanup when the screen unmounts.
  useEffect(() => {
    return () => {
      dismissedRef.current = true;
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      cleanup();
    };
  }, []);

  const finishQuietly = useCallback(() => {
    setVisible(false);
    resetSession();
  }, [resetSession]);

  const begin = useCallback(async () => {
    dismissedRef.current = false;
    stoppedRef.current = false;
    setPhase('checking');
    setTranscript('');
    setParsed(null);
    setErrorKey('');

    if (!isRecognitionAvailable()) {
      setPhase('error');
      setErrorKey('unavailable');
      return;
    }

    const perm = await requestPermissionsAsync();
    if (!perm.granted) {
      setPhase('error');
      setErrorKey('permission');
      return;
    }

    if (dismissedRef.current) return;
    setPhase('listening');
    setInterim('');

    // Lifecycle per voiceService contract:
    // - first final result -> processing + automatic navigation
    // - natural "end" without any final -> could-not-understand -> error
    // - explicit Stop button -> stop(); the natural "end" closes the session
    startRecognition({
      lang: language,
      onInterim: (text) => {
        if (dismissedRef.current || stoppedRef.current) return;
        setInterim(text);
      },
      onFinal: (text) => {
        if (dismissedRef.current || stoppedRef.current) return;
        setTranscript(text);
        const parsedCommand = parseCommand(text);
        setParsed(parsedCommand);
        if (parsedCommand.intent === INTENTS.UNKNOWN) {
          setPhase('error');
          setErrorKey('unknownCommand');
          return;
        }
        setPhase('processing');
        const labelKey = SCREEN_LABEL_KEY[parsedCommand.intent];
        setOpeningLabel(labelKey ? t(labelKey) : '');
      },
      onEnd: (finalText) => {
        if (dismissedRef.current) return;
        if (finalText) return; // a final result already handled navigation
        if (stoppedRef.current) {
          finishQuietly();
          return;
        }
        setPhase('error');
        setErrorKey('notUnderstood');
      },
      onError: (key) => {
        if (dismissedRef.current) return;
        if (stoppedRef.current) {
          finishQuietly();
          return;
        }
        setPhase('error');
        setErrorKey(key);
      },
    });
  }, [language, t, finishQuietly]);

  // When a command is recognised, show the result briefly, then navigate.
  useEffect(() => {
    if (phase !== 'processing' || !parsed) return undefined;
    navTimeoutRef.current = setTimeout(() => {
      navigateForParsed(parsed);
      setPhase('result');
      dismissedRef.current = true;
      setTimeout(() => {
        setVisible(false);
        resetSession();
      }, 400);
    }, 1400);
    return () => {
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    };
  }, [phase, parsed, resetSession]);

  const open = () => {
    setVisible(true);
    begin();
  };

  const close = () => {
    dismissedRef.current = true;
    stopRecognition();
    setVisible(false);
    resetSession();
  };

  const restart = () => {
    begin();
  };

  const stop = () => {
    stoppedRef.current = true;
    stopRecognition();
  };

  const renderTranscript = (text) => (
    <View style={styles.transcriptCard}>
      <Text style={styles.youSaidLabel}>{t('voice.youSaid')}</Text>
      <Text style={styles.transcriptText}>{text}</Text>
    </View>
  );

  const renderError = () => {
    const message = errorKey ? t(`voice.errors.${errorKey}`) : null;
    return (
      <View style={styles.centerBody}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert" size={26} color={theme.colors.error} />
        </View>
        <Text style={styles.errorText}>{message}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, styles.actionGhost]}
            onPress={close}
            accessibilityRole="button"
          >
            <Text style={styles.actionGhostText}>{t('voice.close')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={restart}
            accessibilityRole="button"
          >
            <Ionicons name="mic" size={16} color={theme.colors.textOnPrimary} />
            <Text style={styles.actionPrimaryText}>{t('voice.tryAgain')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('voice.askKisanMitra')}
        accessibilityHint={t('voice.hint')}
      >
        <View style={styles.cardIcon}>
          <Ionicons name="mic" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.cardTexts}>
          <Text style={styles.cardTitle}>{t('voice.askKisanMitra')}</Text>
          <Text style={styles.cardHint}>{t('voice.hint')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textOnPrimary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <Ionicons name="mic" size={15} color={theme.colors.primary} />
                </View>
                <Text style={styles.headerTitle}>{t('voice.askKisanMitra')}</Text>
              </View>
              <View style={styles.headerRight}>
                <View style={styles.langPill}>
                  <Text style={styles.langPillText}>{t(`languages.${language}`)}</Text>
                </View>
                <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('voice.close')}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {phase === 'checking' ? (
              <View style={styles.centerBody}>
                <View style={styles.visualWrap}>
                  <View style={styles.micStack}>
                    <View style={styles.micPill}>
                      <Ionicons name="mic" size={28} color={theme.colors.textOnPrimary} />
                    </View>
                  </View>
                </View>
                <Text style={styles.phaseLabel}>{t('voice.checking')}</Text>
                <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
              </View>
            ) : phase === 'error' ? (
              renderError()
            ) : phase === 'processing' || phase === 'result' ? (
              <View style={styles.centerBody}>
                <View style={styles.visualWrap}>
                  <View style={styles.micStack}>
                    <View style={[styles.micPill, styles.resultPill]}>
                      <Ionicons name="checkmark" size={28} color={theme.colors.textOnPrimary} />
                    </View>
                  </View>
                </View>
                <Text style={styles.phaseLabel}>
                  {phase === 'processing' ? t('voice.processing') : ''}
                </Text>
                {phase === 'processing' ? (
                  <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
                ) : null}
                {transcript ? renderTranscript(transcript) : null}
                {openingLabel ? (
                  <Text style={styles.openingLine}>
                    {t('voice.opening', { screen: openingLabel })}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.centerBody}>
                <View style={styles.visualWrap}>
                  <View style={styles.micStack}>
                    <PulseRing />
                    <View style={styles.micPill}>
                      <Ionicons name="mic" size={28} color={theme.colors.textOnPrimary} />
                    </View>
                  </View>
                  <ListeningBars />
                </View>
                <Text style={styles.phaseLabel}>{t('voice.listening')}</Text>
                {interim || transcript ? renderTranscript(interim || transcript) : null}
                <View style={styles.stopRow}>
                  <Pressable
                    style={[styles.actionButton, styles.actionPrimary]}
                    onPress={stop}
                    accessibilityRole="button"
                  >
                    <Ionicons name="stop" size={18} color={theme.colors.textOnPrimary} />
                    <Text style={styles.actionPrimaryText}>{t('voice.stop')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.radiusLarge,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardPressed: { opacity: 0.92 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTexts: { flex: 1 },
  cardTitle: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
  },
  cardHint: {
    color: theme.colors.textOnPrimary,
    opacity: 0.9,
    fontSize: theme.typography.fontSizes.sm,
    marginTop: theme.spacing.xs,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.spacing.radiusLarge,
    borderTopRightRadius: theme.spacing.radiusLarge,
    maxHeight: '85%',
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  langPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusRound,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  langPillText: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeights.medium,
  },
  centerBody: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    minHeight: 248,
    justifyContent: 'center',
  },
  visualWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 128,
    marginBottom: theme.spacing.md,
  },
  micStack: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
  },
  micPill: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPill: {
    backgroundColor: theme.colors.success,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  equalizerBar: {
    width: 6,
    height: 26,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  phaseLabel: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  transcriptCard: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radiusMedium,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  youSaidLabel: {
    textTransform: 'uppercase',
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  openingLine: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.primary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.badgeError,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  spinner: {
    marginTop: theme.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignSelf: 'stretch',
  },
  stopRow: {
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.spacing.radiusMedium,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 48,
    flex: 1,
  },
  actionPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionPrimaryText: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  actionGhost: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionGhostText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSizes.md,
    fontWeight: theme.typography.fontWeights.semibold,
  },
});
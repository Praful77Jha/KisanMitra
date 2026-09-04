import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { mockChatMessages } from '../data/mockData';
import Header from '../components/Header';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { fetchOrderMessages, sendOrderMessage } from '../services/chatService';

function toDisplay(item, viewerId) {
  // Backend message shape: { id, senderId, body, createdAt }.
  // Mock shape: { id, sender: 'user'|'seller', text, time }.
  const isUser = item.senderId !== undefined
    ? item.senderId === viewerId
    : item.sender === 'user';
  return {
    id: item.id,
    text: item.body !== undefined ? item.body : item.text,
    time: item.createdAt !== undefined ? item.createdAt : item.time,
    isUser,
  };
}

function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sellerName = route.params?.sellerName || t('chat.seller');
  // When opened from an order (OrderDetails), conversation is order-scoped and
  // persistent. Otherwise (catalog ProductDetails) it stays a local mock preview.
  const orderId = route.params?.orderId || null;

  const [messages, setMessages] = useState(() =>
    orderId ? [] : mockChatMessages.map((m) => toDisplay(m, user?.id))
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(!!orderId);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    fetchOrderMessages(orderId)
      .then((data) => {
        if (!cancelled) setMessages((data || []).map((m) => toDisplay(m, user?.id)));
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || t('chat.couldNotLoad'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    if (orderId) {
      setDraft('');
      try {
        const created = await sendOrderMessage(orderId, text);
        setMessages((current) => [
          ...current,
          toDisplay({ ...created, body: created.body }, user?.id),
        ]);
      } catch (e) {
        setLoadError(e.message || t('chat.couldNotLoad'));
      }
      return;
    }
    setMessages((current) => [
      ...current,
      { id: `m-${Date.now()}`, text, time: new Date().toISOString(), isUser: true },
    ]);
    setDraft('');
  };

  const renderMessage = ({ item }) => {
    const isUser = item.isUser;
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleSeller]}>
          <Text style={[styles.msgText, isUser && styles.msgTextUser]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, isUser && styles.msgTimeUser]}>
            {formatTime(item.time)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Header
          title={sellerName}
          showBack
          onBack={() => navigation.goBack()}
        />
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : loadError ? (
              <View style={styles.centerState}>
                <Text style={styles.stateText}>{loadError}</Text>
              </View>
            ) : orderId ? (
              <View style={styles.centerState}>
                <Text style={styles.stateText}>{t('chat.noMessages')}</Text>
              </View>
            ) : null
          }
        />
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.typeMessage')}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSend}
            hitSlop={6}
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={20} color={theme.colors.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  stateText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  msgRow: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  msgRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: theme.spacing.radiusMedium,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  bubbleSeller: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bubbleUser: {
    backgroundColor: theme.colors.primary,
  },
  msgText: {
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  msgTextUser: {
    color: theme.colors.textOnPrimary,
  },
  msgTime: {
    fontSize: theme.typography.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xxs,
    alignSelf: 'flex-end',
  },
  msgTimeUser: {
    color: theme.colors.textOnPrimary,
    opacity: 0.8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.radiusMedium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.radiusRound,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});

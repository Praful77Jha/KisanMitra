import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';

const ICONS = {
  google: { icon: 'logo-google', bg: '#FFFFFF', color: '#DB4437' },
  facebook: { icon: 'logo-facebook', bg: '#FFFFFF', color: '#1877F2' },
  whatsapp: { icon: 'logo-whatsapp', bg: '#FFFFFF', color: '#25D366' },
};

export default function SocialLoginButton({ type, onPress }) {
  const config = ICONS[type];

  return (
    <View style={styles.circle}>
      <Pressable onPress={onPress} style={styles.pressable} hitSlop={6}>
        <Ionicons name={config.icon} size={24} color={config.color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 52,
    height: 52,
    borderRadius: theme.spacing.radiusRound,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

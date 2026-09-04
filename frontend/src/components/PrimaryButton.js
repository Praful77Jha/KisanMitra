import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import theme from '../theme';

export default function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) {
  const styleKey = variant === 'primary' ? 'primary' : variant === 'secondary' ? 'secondary' : 'outline';
  const baseStyle = theme.buttons[styleKey];
  const textStyle = theme.buttons[`${styleKey}Text`];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        baseStyle,
        (disabled || loading) && theme.buttons.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textStyle.color} />
      ) : (
        <Text style={[textStyle, styles.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});

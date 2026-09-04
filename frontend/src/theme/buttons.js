import colors from './colors';
import spacing from './spacing';

export default {
  primary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radiusMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: colors.primaryTint,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radiusMedium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  outline: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.radiusMedium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
};

import { Platform } from 'react-native';

export const theme = {
  colors: {
    // Brand
    wine: '#6D0F2B',
    wineDark: '#4A081D',
    wineLight: '#8C1D40',
    gold: '#D4AF37',
    goldSoft: '#F2D27A',
    goldDark: '#A8841B',

    // Surfaces
    background: '#FBF7F2',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF7E6',

    // Text
    text: '#1B1B1F',
    textMuted: '#5A5A66',
    textOnWine: '#FFFFFF',

    // UI
    border: '#E7DED3',
    shadow: '#000000',
    focusRing: 'rgba(212, 175, 55, 0.35)',

    // Semantic
    danger: '#B42318',
    dangerBg: '#FEE4E2',
    success: '#1A7F37',
    successBg: '#D1FADF',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
  typography: {
    title: {
      fontSize: 22,
      fontWeight: '800' as const,
      color: '#1B1B1F',
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: '#5A5A66',
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      color: '#1B1B1F',
    },
    caption: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: '#5A5A66',
    },
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
  }),
};

export type Theme = typeof theme;

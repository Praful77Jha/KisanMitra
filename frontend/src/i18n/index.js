import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import hi from './hi';
import mr from './mr';

const STORAGE_KEY = 'kisanmitra.language';

const translations = { en, hi, mr };

// Migrate the legacy Punjabi language code to Hindi: the old 'pa' choice is
// replaced by 'hi' so users who selected Punjabi before the change keep a
// valid language instead of falling back to the default.
const LEGACY_LANGUAGE_MAP = { pa: 'hi' };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (mounted && stored) {
        const migrated = LEGACY_LANGUAGE_MAP[stored] || stored;
        if (translations[migrated]) {
          setLanguageState(migrated);
          if (migrated !== stored) {
            AsyncStorage.setItem(STORAGE_KEY, migrated).catch(() => {});
          }
        }
      }
      if (mounted) setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback(async (lang) => {
    if (!translations[lang]) return;
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {
      // Persistence is best-effort; language still changes in-session.
    }
  }, []);

  const t = useCallback((key, params) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
    if (value === undefined || value === null) {
      let fallback = translations.en;
      for (const k of keys) {
        if (fallback && typeof fallback === 'object') {
          fallback = fallback[k];
        } else {
          return key;
        }
      }
      value = fallback;
    }
    if (typeof value !== 'string') return key;
    if (params) {
      return Object.keys(params).reduce(
        (str, paramKey) => str.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), params[paramKey]),
        value,
      );
    }
    return value;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t } = useLanguage();
  return { t };
}

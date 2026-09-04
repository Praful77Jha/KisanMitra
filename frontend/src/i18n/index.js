import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import pa from './pa';
import mr from './mr';

const STORAGE_KEY = 'kisanmitra.language';

const translations = { en, pa, mr };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (mounted && stored && translations[stored]) {
        setLanguageState(stored);
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

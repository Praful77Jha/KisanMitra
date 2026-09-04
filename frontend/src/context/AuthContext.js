import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { register as registerRequest, login as loginRequest, getMe, updateLocation as updateLocationRequest } from '../services/authService';
import { saveToken, getToken, removeToken } from '../services/tokenStorage';
import { setSessionExpiredHandler, clearSessionExpiredHandler } from '../services/authEvents';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const storedToken = await getToken();
        if (!storedToken) {
          if (mounted) setLoading(false);
          return;
        }

        const response = await getMe();
        if (mounted && response.success && response.data) {
          setToken(storedToken);
          setUser(response.data);
        } else if (mounted) {
          await removeToken();
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        if (mounted) {
          await removeToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    // When any authenticated request returns 401 (invalid/expired token),
    // clear the stored session so RootNavigator returns to Auth.
    setSessionExpiredHandler(async () => {
      await removeToken();
      if (mounted) {
        setToken(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      clearSessionExpiredHandler();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    if (response.success && response.data) {
      const { token: newToken, user: authenticatedUser } = response.data;
      await saveToken(newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      return response.data;
    }
    throw new Error('Login failed');
  }, []);

  const register = useCallback(async (data) => {
    const response = await registerRequest(data);
    if (!(response.success && response.data)) {
      throw new Error((response && response.message) || 'Registration failed');
    }

    let loginResponse;
    try {
      loginResponse = await loginRequest({
        phone: data.phone,
        password: data.password,
      });
    } catch (error) {
      await removeToken();
      setToken(null);
      setUser(null);
      throw new Error(
        (error && error.message) ||
          'Account created, but automatic sign-in failed. Please log in.'
      );
    }

    if (loginResponse && loginResponse.success && loginResponse.data) {
      const { token: newToken, user: authenticatedUser } = loginResponse.data;
      await saveToken(newToken);
      setToken(newToken);
      setUser(authenticatedUser);
      return loginResponse.data;
    }

    await removeToken();
    setToken(null);
    setUser(null);
    throw new Error(
      (loginResponse && loginResponse.message) ||
        'Account created, but automatic sign-in failed. Please log in.'
    );
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    setToken(null);
    setUser(null);
  }, []);

  const updateLocation = useCallback(async (location) => {
    const response = await updateLocationRequest(location);
    if (response && response.success && response.data) {
      setUser((prev) => (prev ? { ...prev, location: response.data.location } : prev));
      return response.data;
    }
    throw new Error('Could not update location');
  }, []);

  const value = { user, token, loading, login, register, logout, updateLocation };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

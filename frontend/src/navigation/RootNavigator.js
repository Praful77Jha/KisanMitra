import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import theme from '../theme';
import { useAuth } from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading } = useAuth();

  const initRoute = loading ? 'Splash' : user ? 'Main' : 'Auth';

  return (
    <Stack.Navigator
      initialRouteName={initRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {loading ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : user ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

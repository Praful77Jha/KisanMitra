import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { useTranslation } from '../i18n';
import HomeScreen from '../screens/HomeScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import PostRequirementScreen from '../screens/PostRequirementScreen';
import SellCropScreen from '../screens/SellCropScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import MyRequirementsScreen from '../screens/MyRequirementsScreen';
import OffersScreen from '../screens/OffersScreen';
import ConfirmOrderScreen from '../screens/ConfirmOrderScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentResultScreen from '../screens/PaymentResultScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ChatScreen from '../screens/ChatScreen';
import CompareDealsScreen from '../screens/CompareDealsScreen';
import LogisticsScreen from '../screens/LogisticsScreen';
import PriceInsightsScreen from '../screens/PriceInsightsScreen';
import MarketComparisonScreen from '../screens/MarketComparisonScreen';
import SmartRecommendationScreen from '../screens/SmartRecommendationScreen';
import MakeOfferScreen from '../screens/MakeOfferScreen';
import AvailableNeedsScreen from '../screens/AvailableNeedsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import MyRatingsScreen from '../screens/MyRatingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const getTabIcon = (routeName, focused) => {
  const icons = {
    Home: focused ? 'home' : 'home-outline',
    Marketplace: focused ? 'storefront' : 'storefront-outline',
    Post: focused ? 'add-circle' : 'add-circle-outline',
    Orders: focused ? 'receipt' : 'receipt-outline',
    Profile: focused ? 'person' : 'person-outline',
  };
  return icons[routeName];
};

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={getTabIcon(route.name, focused)} size={size} color={color} />
        ),
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('navigation.home') }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarLabel: t('navigation.marketplace') }} />
      <Tab.Screen
        name="Post"
        component={PostRequirementScreen}
        options={{
          tabBarLabel: t('navigation.sellPost'),
        }}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: t('navigation.orders') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('navigation.profile') }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Tabs"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
      <Stack.Screen name="MyRequirements" component={MyRequirementsScreen} />
      <Stack.Screen name="SellCrop" component={SellCropScreen} />
      <Stack.Screen name="RequirementOffers" component={OffersScreen} />
      <Stack.Screen name="ConfirmOrder" component={ConfirmOrderScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="PaymentResult" component={PaymentResultScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CompareDeals" component={CompareDealsScreen} />
      <Stack.Screen name="Logistics" component={LogisticsScreen} />
      <Stack.Screen name="PriceInsights" component={PriceInsightsScreen} />
      <Stack.Screen name="MarketComparison" component={MarketComparisonScreen} />
      <Stack.Screen name="SmartRecommendation" component={SmartRecommendationScreen} />
      <Stack.Screen name="MakeOffer" component={MakeOfferScreen} />
      <Stack.Screen name="AvailableNeeds" component={AvailableNeedsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="MyRatings" component={MyRatingsScreen} />
    </Stack.Navigator>
  );
}

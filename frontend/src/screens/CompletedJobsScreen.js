import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import theme from '../theme';
import {
  getTransportJobHistory,
  getMyTransportRequests,
} from '../services/transportService';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import TransportJobCard from '../components/TransportJobCard';
import { useTranslation } from '../i18n';

export default function CompletedJobsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [jobs, setJobs] = useState([]);
  const [requestsById, setRequestsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastFocus = React.useRef(0);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    return Promise.all([getTransportJobHistory(), getMyTransportRequests()])
      .then(([jobList, requestList]) => {
        if (cancelled) return;
        setJobs(jobList || []);
        const map = {};
        (requestList || []).forEach((request) => {
          map[request.id] = request;
        });
        setRequestsById(map);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || t('transport.couldNotLoadJobs'));
        setLoading(false);
      });
  }, [t]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([getTransportJobHistory(), getMyTransportRequests()])
      .then(([jobList, requestList]) => {
        setJobs(jobList || []);
        const map = {};
        (requestList || []).forEach((request) => {
          map[request.id] = request;
        });
        setRequestsById(map);
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  React.useEffect(() => {
    if (isFocused) {
      const since = Date.now();
      if (since - lastFocus.current > 400) {
        lastFocus.current = since;
        load();
      }
    }
    return undefined;
  }, [isFocused, load]);

  const renderJob = ({ item }) => (
    <TransportJobCard
      job={item}
      request={requestsById[item.transportRequestId]}
      onPress={() => navigation.navigate('TransportJob', { jobId: item.id })}
    />
  );

  return (
    <View style={styles.screen}>
      <Header
        title={t('transport.completedJobs')}
        showBack
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('emptyStates.couldNotLoadTransport')}
            message={error}
          />
          <PrimaryButton title={t('common.retry')} onPress={load} style={styles.retryButton} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title={t('emptyStates.noCompletedTransportJobs')}
              message={t('emptyStates.noCompletedTransportJobsHint')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  listContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
});
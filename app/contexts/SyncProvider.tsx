// contexts/SyncProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '../services/SyncService';

interface SyncContextType {
  pendingReports: number;
  manualSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  isOnline: boolean;
  lastSyncTime: Date | null;
}

const SyncContext = createContext<SyncContextType | null>(null);

export const useSyncService = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncService must be used within a SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: React.ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [pendingReports, setPendingReports] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const refreshPendingCount = async () => {
    try {
      const count = await syncService.hasPendingReports();
      setPendingReports(count);
      console.log(`Pending reports count updated: ${count}`);
    } catch (error) {
      console.error('Error refreshing pending count:', error);
    }
  };

  const manualSync = async () => {
    try {
      await syncService.manualSync();
      await refreshPendingCount();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error in manual sync:', error);
    }
  };

  useEffect(() => {
    console.log('SyncProvider: Initializing sync service');
    
    // Initialize sync service
    syncService.initialize();
    
    // Setup enhanced network-based sync
    syncService.setupNetworkBasedSync();
    
    // Initial counts
    refreshPendingCount();

    // Monitor network connectivity
    const networkUnsubscribe = NetInfo.addEventListener((state) => {
      console.log(`SyncProvider: Network state changed to ${state.isConnected ? 'Online' : 'Offline'}`);
      setIsOnline(state.isConnected || false);
      
      // If we just came online and have pending reports, trigger sync
      if (state.isConnected && pendingReports > 0) {
        console.log('SyncProvider: Came online with pending reports, triggering sync');
        setTimeout(() => {
          syncService.syncOfflineReports(false).then(() => {
            refreshPendingCount();
            setLastSyncTime(new Date());
          });
        }, 2000); // Small delay to ensure connection is stable
      }
    });

    // Handle app state changes with enhanced logic
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`SyncProvider: App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // App came to foreground
        console.log('SyncProvider: App became active, checking for sync opportunities');
        
        // Refresh pending count
        refreshPendingCount();
        
        // Check if we should sync
        NetInfo.fetch().then((state) => {
          if (state.isConnected && pendingReports > 0) {
            console.log('SyncProvider: App active + online + pending reports, syncing');
            syncService.syncOfflineReports(false).then(() => {
              refreshPendingCount();
              setLastSyncTime(new Date());
            });
          }
        });
      } else if (nextAppState === 'background') {
        console.log('SyncProvider: App went to background');
        // The sync service handles background sync internally
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic check for pending reports every 60 seconds when app is active
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        console.log('SyncProvider: Periodic check - refreshing pending count');
        refreshPendingCount();
        
        // Also check if we have pending reports and are online
        NetInfo.fetch().then((state) => {
          if (state.isConnected && pendingReports > 0) {
            // Only auto-sync if last sync was more than 2 minutes ago
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            if (!lastSyncTime || lastSyncTime < twoMinutesAgo) {
              console.log('SyncProvider: Periodic sync triggered');
              syncService.syncOfflineReports(false).then(() => {
                refreshPendingCount();
                setLastSyncTime(new Date());
              });
            }
          }
        });
      }
    }, 60000); // 60 seconds

    // Aggressive sync check when network changes (with debouncing)
    let networkSyncTimeout: ReturnType<typeof setTimeout> | null = null;
    const aggressiveNetworkListener = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        // Clear any existing timeout
        if (networkSyncTimeout) {
          clearTimeout(networkSyncTimeout);
        }
        
        // Set a new timeout for sync
        networkSyncTimeout = setTimeout(async () => {
          try {
            const pendingCount = await syncService.hasPendingReports();
            if (pendingCount > 0) {
              console.log(`SyncProvider: Aggressive sync - found ${pendingCount} pending reports`);
              await syncService.syncOfflineReports(false);
              await refreshPendingCount();
              setLastSyncTime(new Date());
            }
          } catch (error) {
            console.error('SyncProvider: Aggressive sync failed:', error);
          }
        }, 3000); // 3 second delay after network becomes available
      }
    });

    return () => {
      console.log('SyncProvider: Cleaning up');
      syncService.cleanup();
      appStateSubscription?.remove();
      networkUnsubscribe();
      aggressiveNetworkListener();
      clearInterval(intervalId);
      
      if (networkSyncTimeout) {
        clearTimeout(networkSyncTimeout);
      }
    };
  }, [pendingReports, lastSyncTime]); // Add dependencies to trigger re-evaluation

  const contextValue: SyncContextType = {
    pendingReports,
    manualSync,
    refreshPendingCount,
    isOnline,
    lastSyncTime,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};
// contexts/SyncProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { syncService } from '../services/SyncService'; // Correct path to services folder

interface SyncContextType {
  pendingReports: number;
  manualSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
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
    } catch (error) {
      console.error('Error in manual sync:', error);
    }
  };

  useEffect(() => {
    console.log('SyncProvider: Initializing sync service');
    
    // Initialize sync service
    syncService.initialize();
    refreshPendingCount();

    // Handle app state changes (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`App state changed to: ${nextAppState}`);
      if (nextAppState === 'active') {
        // App came to foreground, check for pending reports and sync if needed
        refreshPendingCount();
        syncService.syncOfflineReports();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic check for pending reports (every 30 seconds when app is active)
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        console.log('Periodic check: refreshing pending count');
        refreshPendingCount();
      }
    }, 30000);

    return () => {
      console.log('SyncProvider: Cleaning up');
      syncService.cleanup();
      subscription?.remove();
      clearInterval(intervalId);
    };
  }, []);

  const contextValue: SyncContextType = {
    pendingReports,
    manualSync,
    refreshPendingCount,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
};
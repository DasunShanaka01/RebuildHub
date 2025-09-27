// services/ExpoSyncService.ts
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncService } from './SyncService';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

// Define the background task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('Background sync task executed');
    await syncService.syncOfflineReports(false);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background sync failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register background fetch
export const registerBackgroundSync = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60, // 1 minute
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background sync registered successfully');
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
};

// Unregister background fetch
export const unregisterBackgroundSync = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('Background sync unregistered');
  } catch (error) {
    console.error('Failed to unregister background sync:', error);
  }
};

const ExpoSyncService = {
  registerBackgroundSync,
  unregisterBackgroundSync,
};

export default ExpoSyncService;
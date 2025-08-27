// services/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../FirebaseConfig';
import { Alert, AppState } from 'react-native';

const CLOUDINARY_CONFIG = {
  cloudName: 'dkp01emhb',
  uploadPreset: 'adadadad',
};

interface MediaItem {
  id: string;
  url: string;
  userId: string;
  uploadedAt: Date;
  filename: string;
}

class SyncService {
  private isSyncing = false;
  private networkListener: any = null;
  private backgroundSyncInterval: any = null;
  private appStateListener: any = null;
  private lastSyncAttempt = 0;
  private readonly BACKGROUND_SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MIN_SYNC_INTERVAL = 15000; // 15 seconds minimum between syncs

  // Initialize the sync service
  initialize() {
    console.log('SyncService: Initializing...');
    
    // Listen for network changes
    this.networkListener = NetInfo.addEventListener((state) => {
      console.log(`Network state changed: ${state.isConnected ? 'Online' : 'Offline'}`);
      if (state.isConnected && !this.isSyncing) {
        console.log('Network is connected, triggering sync...');
        this.syncOfflineReports();
      }
    });

    // Listen for app state changes
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      console.log(`App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'background') {
        this.startBackgroundSync();
      } else if (nextAppState === 'active') {
        this.stopBackgroundSync();
        // Sync when app comes to foreground
        this.syncOfflineReports();
      }
    });

    // Initial sync attempt
    NetInfo.fetch().then((state) => {
      console.log(`Initial network check: ${state.isConnected ? 'Online' : 'Offline'}`);
      if (state.isConnected && !this.isSyncing) {
        console.log('Initial sync attempt...');
        this.syncOfflineReports();
      }
    });

    // Start background sync if app is already in background
    if (AppState.currentState === 'background') {
      this.startBackgroundSync();
    }
  }

  // Start background sync using standard JavaScript setInterval
  private startBackgroundSync() {
    console.log('Starting background sync timer...');
    
    // Clear any existing interval
    this.stopBackgroundSync();
    
    // Use regular setInterval (works in background for limited time)
    this.backgroundSyncInterval = setInterval(() => {
      console.log('Background sync timer triggered');
      this.backgroundSyncCheck();
    }, this.BACKGROUND_SYNC_INTERVAL);
  }

  // Stop background sync timer
  private stopBackgroundSync() {
    if (this.backgroundSyncInterval) {
      console.log('Stopping background sync timer...');
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
  }

  // Background sync check with throttling
  private async backgroundSyncCheck() {
    const now = Date.now();
    
    // Throttle sync attempts
    if (now - this.lastSyncAttempt < this.MIN_SYNC_INTERVAL) {
      console.log('Background sync throttled, too soon since last attempt');
      return;
    }

    try {
      // Check if we have pending reports
      const pendingCount = await this.hasPendingReports();
      if (pendingCount === 0) {
        console.log('No pending reports, skipping background sync');
        return;
      }

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No network connection, skipping background sync');
        return;
      }

      console.log(`Background sync: Found ${pendingCount} pending reports, attempting sync...`);
      this.lastSyncAttempt = now;
      await this.syncOfflineReports(false); // Don't show alerts in background
      
    } catch (error) {
      console.error('Background sync check error:', error);
    }
  }

  // Clean up listeners
  cleanup() {
    console.log('SyncService: Cleaning up...');
    
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
    
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    
    this.stopBackgroundSync();
  }

  private uploadToCloudinary = async (uri: string, userId: string): Promise<MediaItem> => {
    const isVideo = uri.match(/\.(mp4|mov)$/i);
    const endpoint = isVideo
      ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`
      : `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: isVideo ? 'video/mp4' : 'image/jpeg',
      name: `report-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
    } as any);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.asset_id,
      url: data.secure_url,
      userId,
      uploadedAt: new Date(),
      filename: data.original_filename || `report-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
    };
  };

  // Auto-sync offline reports with enhanced error handling
  syncOfflineReports = async (showAlert: boolean = false) => {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    // Double-check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('No network connection, cannot sync');
      if (showAlert) {
        Alert.alert('No Connection', 'Please check your internet connection and try again.');
      }
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync process...');

    try {
      const keys = await AsyncStorage.getAllKeys();
      const reportKeys = keys.filter((key) => key.startsWith('report-'));
      
      if (reportKeys.length === 0) {
        console.log('No offline reports to sync');
        this.isSyncing = false;
        return;
      }

      console.log(`Found ${reportKeys.length} offline reports to sync`);
      const reports = await AsyncStorage.multiGet(reportKeys);
      let syncedCount = 0;
      let failedCount = 0;

      for (const [key, value] of reports) {
        if (value) {
          try {
            console.log(`Syncing report: ${key}`);
            const report = JSON.parse(value);
            const userId = report.userId;
            let mediaItem: MediaItem | null = null;

            // Upload media if present
            if (report.image) {
              if (typeof report.image === 'string') {
                console.log(`Uploading media for report: ${key}`);
                mediaItem = await this.uploadToCloudinary(report.image, userId);
                console.log(`Media uploaded successfully for report: ${key}`);
              } else {
                console.warn(`Skipping invalid image data for report ${key}`);
                failedCount++;
                continue;
              }
            }

            // Save to Firestore
            const docRef = await addDoc(collection(db, 'reportData'), {
              ...report,
              media: mediaItem ? [mediaItem] : [],
              reportStatus: report.reportStatus || 'pending',
              syncedAt: new Date(), // Add sync timestamp
            });

            console.log(`Report synced to Firestore with ID: ${docRef.id}`);

            // Remove from local storage only after successful sync
            await AsyncStorage.removeItem(key);
            syncedCount++;
            console.log(`Successfully synced and removed report: ${key}`);
            
          } catch (error) {
            console.error(`Failed to sync report ${key}:`, error);
            failedCount++;
            
            // If it's a network error, stop trying other reports
            if (error instanceof Error && (
              error.message.includes('Network') || 
              error.message.includes('fetch') ||
              error.message.includes('timeout')
            )) {
              console.log('Network error detected, stopping sync process');
              break;
            }
          }
        }
      }

      const message = `Successfully synced ${syncedCount} report(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`;
      console.log(`Sync completed: ${message}`);
      
      if (showAlert && syncedCount > 0) {
        Alert.alert('Sync Complete', message);
      }

      // Store sync statistics
      await AsyncStorage.setItem('lastSyncStats', JSON.stringify({
        timestamp: new Date().toISOString(),
        syncedCount,
        failedCount,
        totalAttempted: syncedCount + failedCount
      }));

    } catch (error: any) {
      console.error('Sync error:', error);
      if (showAlert) {
        Alert.alert('Sync Error', 'Failed to sync offline reports: ' + error.message);
      }
    } finally {
      this.isSyncing = false;
      console.log('Sync process completed');
    }
  };

  // Manual sync method
  manualSync = async () => {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }
    await this.syncOfflineReports(true);
  };

  // Check if there are pending offline reports
  hasPendingReports = async (): Promise<number> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.filter((key) => key.startsWith('report-')).length;
    } catch (error) {
      console.error('Error checking pending reports:', error);
      return 0;
    }
  };

  // Get last sync statistics
  getLastSyncStats = async () => {
    try {
      const statsJson = await AsyncStorage.getItem('lastSyncStats');
      return statsJson ? JSON.parse(statsJson) : null;
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return null;
    }
  };

  // Force sync (ignores throttling)
  forceSync = async () => {
    this.lastSyncAttempt = 0;
    await this.syncOfflineReports(true);
  };

  // Enhanced network-based sync with retry mechanism
  setupNetworkBasedSync = () => {
    console.log('Setting up network-based sync...');
    
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds

    const attemptSync = async () => {
      try {
        const pendingCount = await this.hasPendingReports();
        if (pendingCount > 0) {
          console.log(`Network sync: Attempting to sync ${pendingCount} reports (retry ${retryCount})`);
          await this.syncOfflineReports(false);
          retryCount = 0; // Reset on success
        }
      } catch (error) {
        console.error('Network sync failed:', error);
        retryCount++;
        
        if (retryCount <= maxRetries) {
          console.log(`Retrying sync in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`);
          setTimeout(attemptSync, retryDelay);
        } else {
          console.log('Max retry attempts reached, giving up');
          retryCount = 0;
        }
      }
    };

    // Enhanced network listener with retry logic
    if (this.networkListener) {
      this.networkListener();
    }
    
    this.networkListener = NetInfo.addEventListener((state) => {
      console.log(`Enhanced network state changed: ${state.isConnected ? 'Online' : 'Offline'}`);
      if (state.isConnected && !this.isSyncing) {
        // Small delay to ensure network is stable
        setTimeout(attemptSync, 1000);
      }
    });
  };
}

// Export singleton instance
export const syncService = new SyncService();
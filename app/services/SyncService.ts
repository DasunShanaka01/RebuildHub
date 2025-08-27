// services/SyncService.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../FirebaseConfig'; // Adjust path as needed
import { Alert } from 'react-native';

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

    // Initial sync attempt
    NetInfo.fetch().then((state) => {
      console.log(`Initial network check: ${state.isConnected ? 'Online' : 'Offline'}`);
      if (state.isConnected && !this.isSyncing) {
        console.log('Initial sync attempt...');
        this.syncOfflineReports();
      }
    });
  }

  // Clean up listeners
  cleanup() {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
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

  // Auto-sync offline reports
  syncOfflineReports = async (showAlert: boolean = false) => {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;

    try {
      const keys = await AsyncStorage.getAllKeys();
      const reportKeys = keys.filter((key) => key.startsWith('report-'));
      
      if (reportKeys.length === 0) {
        this.isSyncing = false;
        return;
      }

      const reports = await AsyncStorage.multiGet(reportKeys);
      let syncedCount = 0;
      let failedCount = 0;

      for (const [key, value] of reports) {
        if (value) {
          try {
            const report = JSON.parse(value);
            const userId = report.userId;
            let mediaItem: MediaItem | null = null;

            if (report.image) {
              if (typeof report.image === 'string') {
                mediaItem = await this.uploadToCloudinary(report.image, userId);
              } else {
                console.warn(`Skipping invalid image data for report ${key}`);
                failedCount++;
                continue;
              }
            }

            await addDoc(collection(db, 'reportData'), {
              ...report,
              media: mediaItem ? [mediaItem] : [],
              reportStatus: report.reportStatus || 'pending',
            });

            await AsyncStorage.removeItem(key);
            syncedCount++;
            console.log(`Synced and removed report: ${key}`);
          } catch (error) {
            console.error(`Failed to sync report ${key}:`, error);
            failedCount++;
          }
        }
      }

      if (showAlert && syncedCount > 0) {
        Alert.alert(
          'Sync Complete', 
          `Successfully synced ${syncedCount} report(s).${failedCount > 0 ? ` ${failedCount} failed.` : ''}`
        );
      }

      console.log(`Sync completed: ${syncedCount} successful, ${failedCount} failed`);
    } catch (error: any) {
      console.error('Sync error:', error);
      if (showAlert) {
        Alert.alert('Sync Error', 'Failed to sync offline reports: ' + error.message);
      }
    } finally {
      this.isSyncing = false;
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
}

// Export singleton instance
export const syncService = new SyncService();
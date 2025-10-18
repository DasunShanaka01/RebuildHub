// Enhanced UI for Disaster Management App - Improved Design
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../FirebaseConfig';
import BackButton from '../../components/BackButton';
import { useSyncService } from '../contexts/SyncProvider';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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

type DropdownItem = { 
  label: string; 
  value: string; 
  icon?: string; 
  color?: string; 
};
type CustomDropdownProps = {
  items: DropdownItem[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder: string;
  style?: object;
};

const CustomDropdown: React.FC<CustomDropdownProps> = ({ items, selectedValue, onSelect, placeholder, style }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: DropdownItem) => {
    onSelect(item.value);
    setIsOpen(false);
  };

  const selectedItem = items.find(item => item.value === selectedValue);

  return (
    <View style={style}>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setIsOpen(true)}>
        <View style={styles.dropdownButtonContent}>
          {selectedItem && selectedItem.icon && (
            <Text style={[styles.dropdownButtonIcon, selectedItem.color && { color: selectedItem.color }]}>
              {selectedItem.icon}
            </Text>
          )}
          <Text style={[styles.dropdownButtonText, !selectedItem && styles.placeholderText]}>
            {selectedItem ? selectedItem.label : placeholder}
          </Text>
        </View>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <View style={styles.modalContent}>
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedValue === item.value && styles.selectedItem]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.dropdownItemContent}>
                    {item.icon && (
                      <Text style={[styles.dropdownItemIcon, item.color && { color: item.color }]}>
                        {item.icon}
                      </Text>
                    )}
                    <Text style={[styles.dropdownItemText, selectedValue === item.value && styles.selectedItemText]}>
                      {item.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default function DamageReportForm() {
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pendingReports, manualSync, refreshPendingCount } = useSyncService();
  const [user, setUser] = useState<User | null>(null);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const categories = [
    { label: 'Earthquakes', value: 'earthquakes', icon: '🌍', color: '#8b5cf6' },
    { label: 'Tsunamis', value: 'tsunamis', icon: '🌊', color: '#06b6d4' },
    { label: 'Landslides', value: 'landslides', icon: '⛰️', color: '#f59e0b' },
    { label: 'Floods', value: 'floods', icon: '🌧️', color: '#3b82f6' },
    { label: 'Droughts', value: 'droughts', icon: '☀️', color: '#f97316' },
    { label: 'Wildfires', value: 'wildfires', icon: '🔥', color: '#ef4444' },
  ];

  const severities = [
    { label: 'Low', value: 'low', icon: '🟢', color: '#10b981' },
    { label: 'Medium', value: 'medium', icon: '🟡', color: '#f59e0b' },
    { label: 'High', value: 'high', icon: '🔴', color: '#ef4444' },
  ];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser && id) {
        setUser({ uid: id } as User);
      }
    });

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeNet();
    };
  }, [id]);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc.coords);

      // Only attempt reverse geocoding when online. reverseGeocodeAsync
      // may attempt network calls and throw when offline (IOException).
      let fullAddress = '';
      try {
        if (!isOffline) {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });

          if (reverseGeocode.length > 0) {
            const addr = reverseGeocode[0];
            fullAddress = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''} ${addr.country || ''}`.trim();
            setAddress(fullAddress);
          }
        } else {
          // Offline - skip reverse geocoding
          console.log('Offline - skipping reverse geocode');
        }
      } catch (err: any) {
        // Don't surface a hard error to the user for reverse geocode failures when offline.
        console.warn('Reverse geocode failed:', err?.message || err);
      }

      // Use the computed address (if any) or existing address state
      Alert.alert('Location Captured', `Address: ${fullAddress || address || 'Unknown'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get location: ' + (error as Error).message);
    }
  };

  const geocodeAddress = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    if (isOffline) {
      Alert.alert('Offline', 'Cannot geocode address while offline. Please connect to the internet and try again.');
      return;
    }

    try {
      const geocode = await Location.geocodeAsync(address);
      if (geocode.length > 0) {
        const coords = geocode[0];
        setLocation(coords);
        Alert.alert('Address Found', `Lat: ${coords.latitude.toFixed(4)}, Lon: ${coords.longitude.toFixed(4)}`);
      } else {
        Alert.alert('Error', 'Address not found');
      }
    } catch (error: any) {
      console.warn('Geocode failed:', error?.message || error);
      Alert.alert('Error', 'Failed to geocode address: ' + (error as Error).message);
    }
  };

  const setManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Error', 'Please enter valid latitude and longitude');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      Alert.alert('Error', 'Latitude must be between -90 and 90');
      return;
    }
    
    if (lon < -180 || lon > 180) {
      Alert.alert('Error', 'Longitude must be between -180 and 180');
      return;
    }
    
    setLocation({ latitude: lat, longitude: lon });
    setAddress('');
    Alert.alert('Location Set', `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadToCloudinary = async (uri: string, userId: string): Promise<MediaItem> => {
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

  const handleSubmit = async () => {
    if (!description || !category || !severity || !location) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!user && !id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const userId = user?.uid || id;
    const reportData = {
      userId,
      description,
      category,
      severity,
      location,
      timestamp: new Date(),
      reportStatus: 'pending',
    };

    try {
      if (isOffline) {
        await AsyncStorage.setItem(`report-${Date.now()}`, JSON.stringify({ ...reportData, image }));
        Alert.alert('Success', 'Report saved offline. Will sync automatically when online.');
        await refreshPendingCount();
      } else {
        let mediaItem: MediaItem | null = null;
        if (image && typeof image === 'string') {
          mediaItem = await uploadToCloudinary(image, userId);
        }

        await addDoc(collection(db, 'reportData'), {
          ...reportData,
          media: mediaItem ? [mediaItem] : [],
        });
        Alert.alert('Success', 'Damage Report Submitted');
      }

      setDescription('');
      setImage(null);
      setLocation(null);
      setAddress('');
      setManualLat('');
      setManualLon('');
      setShowLocationInput(false);
      setCategory(null);
      setSeverity(null);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to submit report: ' + error.message);
    }
  };

  const handleCancel = () => {
    setDescription('');
    setImage(null);
    setLocation(null);
    setAddress('');
    setManualLat('');
    setManualLon('');
    setShowLocationInput(false);
    setCategory(null);
    setSeverity(null);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BackButton />
        
        <View style={styles.header}>
          <Text style={styles.title}>Disaster Report</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isOffline ? '#FF6B6B' : '#4CAF50' }]} />
            <Text style={styles.statusLabel}>{isOffline ? 'Offline' : 'Online'}</Text>
          </View>
        </View>
        
        {pendingReports > 0 && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingIcon}>⚠️</Text>
              <Text style={styles.pendingText}>{pendingReports} report(s) pending sync</Text>
            </View>
            <TouchableOpacity style={styles.syncButton} onPress={manualSync}>
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>Description *</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the damage in detail..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.sectionLabel}>Category *</Text>
          <CustomDropdown
            items={categories}
            selectedValue={category}
            onSelect={setCategory}
            placeholder="Select disaster category"
            style={styles.dropdownWrapper}
          />

          <Text style={styles.sectionLabel}>Severity *</Text>
          <CustomDropdown
            items={severities}
            selectedValue={severity}
            onSelect={setSeverity}
            placeholder="Select severity level"
            style={styles.dropdownWrapper}
          />

          <Text style={styles.sectionLabel}>Media (Optional)</Text>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Text style={styles.mediaButtonIcon}>📷</Text>
            <Text style={styles.mediaButtonText}>
              {image ? 'Change Media' : 'Add Photo/Video'}
            </Text>
          </TouchableOpacity>
          {image && <Image source={{ uri: image }} style={styles.imagePreview} />}
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.cardTitle}>Location *</Text>
          
          <View style={styles.locationButtonGroup}>
            <TouchableOpacity style={styles.primaryButton} onPress={getLocation}>
              <Text style={styles.primaryButtonText}>📍 Current Location</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => setShowLocationInput(!showLocationInput)}
            >
              <Text style={styles.secondaryButtonText}>✏️ Manual Entry</Text>
            </TouchableOpacity>
          </View>

          {showLocationInput && (
            <View style={styles.manualInputSection}>
              <Text style={styles.inputLabel}>Search Address</Text>
              <View style={styles.addressInputGroup}>
                <TextInput
                  style={styles.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter full address"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity style={styles.searchButton} onPress={geocodeAddress}>
                  <Text style={styles.searchButtonText}>🔍</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.inputLabel}>Enter Coordinates</Text>
              <View style={styles.coordRow}>
                <TextInput
                  style={styles.coordInput}
                  value={manualLat}
                  onChangeText={setManualLat}
                  placeholder="Latitude"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.coordInput}
                  value={manualLon}
                  onChangeText={setManualLon}
                  placeholder="Longitude"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity style={styles.setLocationButton} onPress={setManualLocation}>
                <Text style={styles.setLocationButtonText}>Set Location</Text>
              </TouchableOpacity>
            </View>
          )}

          {location ? (
            <View style={styles.locationPreview}>
              <View style={styles.coordDisplay}>
                <Text style={styles.coordText}>
                  📌 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
                {address && <Text style={styles.addressDisplay}>{address}</Text>}
              </View>
              
              <View style={styles.mapWrapper}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  region={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  loadingEnabled={true}
                  loadingIndicatorColor="#2563EB"
                >
                  <Marker
                    coordinate={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }}
                    title="Report Location"
                    description={address || "Damage Report Location"}
                  />
                </MapView>
              </View>
            </View>
          ) : (
            <View style={styles.noLocationCard}>
              <Text style={styles.noLocationIcon}>🗺️</Text>
              <Text style={styles.noLocationText}>No location set</Text>
              <Text style={styles.noLocationHint}>Please capture or enter location</Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    // Gradient-like background effect
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a202c',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
  },
  pendingCard: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#f59e0b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingIcon: {
    fontSize: 24,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pendingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
    flex: 1,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  syncButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  formCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  textArea: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    fontSize: 16,
    color: '#1f2937',
    minHeight: 120,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownWrapper: {
    marginBottom: 20,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#f9fafb',
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownButtonIcon: {
    fontSize: 22,
    marginRight: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    minWidth: 28,
    textAlign: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  placeholderText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: 350,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedItem: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownItemIcon: {
    fontSize: 24,
    marginRight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    minWidth: 32,
    textAlign: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    letterSpacing: 0.2,
    flex: 1,
  },
  selectedItemText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaButtonIcon: {
    fontSize: 28,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mediaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.3,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  locationCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 18,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationButtonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  manualInputSection: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  addressInputGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  addressInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    width: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  searchButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#d1d5db',
    borderRadius: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '700',
    letterSpacing: 0.5,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  coordInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  setLocationButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#059669',
  },
  setLocationButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  locationPreview: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coordDisplay: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coordText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  addressDisplay: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  map: {
    flex: 1,
  },
  noLocationCard: {
    backgroundColor: '#f8fafc',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noLocationIcon: {
    fontSize: 48,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  noLocationText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  noLocationHint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#ef4444',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // Additional modern styles for enhanced UX
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingSpinner: {
    width: 50,
    height: 50,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: 25,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  successMessage: {
    backgroundColor: '#d1fae5',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 20,
    color: '#10b981',
    marginRight: 12,
  },
  successText: {
    flex: 1,
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 20,
    color: '#ef4444',
    marginRight: 12,
  },
  errorText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d1d5db',
    marginHorizontal: 8,
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#3b82f6',
  },

  // Enhanced icon styling
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  categoryIcon: {
    fontSize: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  severityIcon: {
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
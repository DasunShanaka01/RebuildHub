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

type DropdownItem = { label: string; value: string };
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
        <Text style={[styles.dropdownButtonText, !selectedItem && styles.placeholderText]}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
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
                  <Text style={[styles.dropdownItemText, selectedValue === item.value && styles.selectedItemText]}>
                    {item.label}
                  </Text>
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
    { label: 'Earthquakes', value: 'earthquakes' },
    { label: 'Tsunamis', value: 'tsunamis' },
    { label: 'Landslides', value: 'landslides' },
    { label: 'Floods', value: 'floods' },
    { label: 'Droughts', value: 'droughts' },
    { label: 'Wildfires', value: 'wildfires' },
  ];

  const severities = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
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
      
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const fullAddress = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''} ${addr.country || ''}`.trim();
        setAddress(fullAddress);
      }
      
      Alert.alert('Location Captured', `Address: ${address || 'Unknown'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get location: ' + (error as Error).message);
    }
  };

  const geocodeAddress = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
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
    } catch (error) {
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
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  syncButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 4,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    fontSize: 15,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dropdownWrapper: {
    marginBottom: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#F8FAFC',
    minHeight: 52,
  },
  dropdownButtonText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 300,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectedItem: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#334155',
  },
  selectedItemText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  mediaButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  mediaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  locationButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  manualInputSection: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  addressInputGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addressInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1E293B',
  },
  searchButton: {
    backgroundColor: '#2563EB',
    width: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  coordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
    color: '#1E293B',
  },
  setLocationButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  setLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  locationPreview: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
  },
  coordDisplay: {
    marginBottom: 12,
  },
  coordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  addressDisplay: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  mapWrapper: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  map: {
    flex: 1,
  },
  noLocationCard: {
    backgroundColor: '#F8FAFC',
    padding: 32,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noLocationIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  noLocationHint: {
    fontSize: 13,
    color: '#94A3B8',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
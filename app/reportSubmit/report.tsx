// Remove the sync logic from DamageReportForm and simplify it
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
    // Monitor auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser && id) {
        setUser({ uid: id } as User); // Fallback to id if no user is logged in
      }
    });

    // Monitor network status
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
      
      // Reverse geocode to get address
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
        // Store report offline
        await AsyncStorage.setItem(`report-${Date.now()}`, JSON.stringify({ ...reportData, image }));
        Alert.alert('Success', 'Report saved offline. Will sync automatically when online.');
        await refreshPendingCount(); // Update pending count
      } else {
        // Upload image to Cloudinary if present
        let mediaItem: MediaItem | null = null;
        if (image && typeof image === 'string') {
          mediaItem = await uploadToCloudinary(image, userId);
        }

        // Save report to Firestore
        await addDoc(collection(db, 'reportData'), {
          ...reportData,
          media: mediaItem ? [mediaItem] : [],
        });
        Alert.alert('Success', 'Damage Report Submitted');
      }

      // Reset form
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
        
        <Text style={styles.title}>Damage Reporting</Text>
        <Text style={styles.userText}>User: {user?.email || `User-${id}`}</Text>
        
        {/* Show pending reports status */}
        {pendingReports > 0 && (
          <View style={styles.pendingReportsContainer}>
            <Text style={styles.pendingReportsText}>
              {pendingReports} report(s) pending sync
            </Text>
            <Button title="Sync Now" onPress={manualSync} color="#FF9800" />
          </View>
        )}
        
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the damage"
          multiline
        />
        <Button title="Pick Image/Video" onPress={pickImage} />
        {image && <Image source={{ uri: image }} style={styles.imagePreview} />}
        
        {/* Enhanced Location Section */}
        <View style={styles.locationSection}>
          <Text style={styles.sectionTitle}>Location Information</Text>
          
          {/* Location Buttons */}
          <View style={styles.locationButtons}>
            <Button title="Get Current Location" onPress={getLocation} color="#4DB6AC" />
            <Button 
              title={showLocationInput ? "Hide Manual Input" : "Manual Input"} 
              onPress={() => setShowLocationInput(!showLocationInput)} 
              color="#FF9800" 
            />
          </View>
          
          {/* Manual Location Input */}
          {showLocationInput && (
            <View style={styles.manualLocationContainer}>
              <Text style={styles.label}>Enter Address:</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter full address"
              />
              <Button title="Find Address" onPress={geocodeAddress} color="#4DB6AC" />
              
              <Text style={styles.label}>Or Enter Coordinates:</Text>
              <View style={styles.coordinateInputs}>
                <TextInput
                  style={[styles.input, styles.coordinateInput]}
                  value={manualLat}
                  onChangeText={setManualLat}
                  placeholder="Latitude"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.coordinateInput]}
                  value={manualLon}
                  onChangeText={setManualLon}
                  placeholder="Longitude"
                  keyboardType="numeric"
                />
              </View>
              <Button title="Set Coordinates" onPress={setManualLocation} color="#4DB6AC" />
            </View>
          )}
          
          {/* Location Display */}
          {location && (
            <View style={styles.locationDisplay}>
              <Text style={styles.locationText}>
                📍 Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}
              </Text>
              {address && (
                <Text style={styles.addressText}>
                  📍 Address: {address}
                </Text>
              )}
              
              {/* Small Map View */}
              <View style={styles.mapContainer}>
                <Text style={styles.debugText}>Map should appear here</Text>
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
                  loadingIndicatorColor="#4DB6AC"
                  onMapReady={() => console.log('Map is ready')}
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
          )}
          
          {/* Debug: Show map even without location for testing */}
          {!location && (
            <View style={styles.locationDisplay}>
              <Text style={styles.debugText}>No location set yet. Get location or enter manually to see map.</Text>
              <View style={styles.mapContainer}>
                <Text style={styles.debugText}>Map will appear here once location is set</Text>
                <View style={styles.placeholderMap}>
                  <Text style={styles.mapPlaceholderText}>🗺️ Map Placeholder</Text>
                  <Text style={styles.placeholderSubtext}>Set a location to see the map</Text>
                </View>
              </View>
            </View>
          )}
        </View>
        
        <Text style={styles.label}>Select Damage Category</Text>
        <CustomDropdown
          items={categories}
          selectedValue={category}
          onSelect={setCategory}
          placeholder="Choose category"
          style={styles.dropdownWrapper}
        />
        <Text style={styles.label}>Select Severity</Text>
        <CustomDropdown
          items={severities}
          selectedValue={severity}
          onSelect={setSeverity}
          placeholder="Choose severity"
          style={styles.dropdownWrapper}
        />
        <View style={styles.buttonRow}>
          <Button title="Submit" onPress={handleSubmit} />
          <Button title="Cancel" color="red" onPress={handleCancel} />
        </View>
        <Text style={styles.statusText}>
          Status: {isOffline ? 'Offline' : 'Online'}
          {pendingReports > 0 && ` • ${pendingReports} pending`}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1A237E',
  },
  userText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  pendingReportsContainer: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  pendingReportsText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#4DB6AC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  imagePreview: {
    width: 150,
    height: 150,
    marginVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  locationText: {
    marginVertical: 8,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#333',
  },
  addressText: {
    marginVertical: 4,
    fontSize: 14,
    color: '#666',
  },
  locationSection: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0F2F1',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 12,
  },
  locationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  manualLocationContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  coordinateInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  coordinateInput: {
    flex: 0.48,
    marginBottom: 0,
  },
  locationDisplay: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4DB6AC',
  },
  mapContainer: {
    height: 200,
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4DB6AC',
  },
  map: {
    flex: 1,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  placeholderMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
  },
  mapPlaceholderText: {
    fontSize: 24,
    color: '#4DB6AC',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  label: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dropdownWrapper: {
    marginBottom: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4DB6AC',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#4DB6AC',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 300,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2F1',
  },
  selectedItem: {
    backgroundColor: '#E0F2F1',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedItemText: {
    color: '#1A237E',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  statusText: {
    marginTop: 10,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
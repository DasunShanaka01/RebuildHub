import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Image, Button, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth, db } from '../../FirebaseConfig';
import BackButton from '../../components/BackButton';
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

interface Report {
  id: string;
  userId: string;
  description: string;
  category: string;
  severity: string;
  location: { latitude: number; longitude: number };
  timestamp: Date;
  reportStatus: string;
  media: MediaItem[];
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

export default function ReportProfile() {
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editSeverity, setEditSeverity] = useState<string | null>(null);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [editAddress, setEditAddress] = useState<string>('');
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLon, setManualLon] = useState<string>('');
  const [showLocationInput, setShowLocationInput] = useState(false);

  useEffect(() => {
    // Monitor auth state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser && id) {
        setUser({ uid: id } as User); // Fallback to id if no user is logged in
      }
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (user || id) {
      fetchReports();
    }
  }, [user, id]);

  const fetchReports = async () => {
    try {
      const userId = user?.uid || id;
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const q = query(collection(db, 'reportData'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const userReports: Report[] = [];
      querySnapshot.forEach((doc) => {
        userReports.push({ id: doc.id, ...doc.data() } as Report);
      });
      setReports(userReports);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch reports: ' + error.message);
    }
  };

  const handleView = (report: Report) => {
    setSelectedReport(report);
    setIsViewModalOpen(true);
  };

  const handleEdit = (report: Report) => {
    setSelectedReport(report);
    setEditDescription(report.description);
    setEditCategory(report.category);
    setEditSeverity(report.severity);
    setEditImage(report.media.length > 0 ? report.media[0].url : null);
    setEditLocation(report.location);
    setEditAddress('');
    setManualLat('');
    setManualLon('');
    setShowLocationInput(false);
    setIsEditModalOpen(true);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditImage(result.assets[0].uri);
    }
  };

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
      setEditLocation(loc.coords);
      
      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const fullAddress = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''} ${addr.country || ''}`.trim();
        setEditAddress(fullAddress);
      }
      
      Alert.alert('Location Captured', `Address: ${editAddress || 'Unknown'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get location: ' + (error as Error).message);
    }
  };

  const geocodeAddress = async () => {
    if (!editAddress.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }
    
    try {
      const geocode = await Location.geocodeAsync(editAddress);
      if (geocode.length > 0) {
        const coords = geocode[0];
        setEditLocation(coords);
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
    
    setEditLocation({ latitude: lat, longitude: lon });
    setEditAddress('');
    Alert.alert('Location Set', `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`);
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

  const handleSaveEdit = async () => {
    if (!selectedReport) return;
    if (!editDescription || !editCategory || !editSeverity || !editLocation) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const userId = user?.uid || id;
      let mediaItem: MediaItem | null = null;
      if (editImage && typeof editImage === 'string' && editImage !== (selectedReport.media[0]?.url || null)) {
        mediaItem = await uploadToCloudinary(editImage, userId);
      }

      const reportRef = doc(db, 'reportData', selectedReport.id);
      await updateDoc(reportRef, {
        description: editDescription,
        category: editCategory,
        severity: editSeverity,
        location: editLocation,
        media: mediaItem ? [mediaItem] : selectedReport.media,
      });
      Alert.alert('Success', 'Report updated successfully');
      setIsEditModalOpen(false);
      fetchReports(); // Refresh the list
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update report: ' + error.message);
    }
  };

  const handleDelete = async (reportId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'reportData', reportId));
              Alert.alert('Success', 'Report deleted successfully');
              fetchReports(); // Refresh the list
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete report: ' + error.message);
            }
          },
        },
      ]
    );
  };

  // Small Map Component for each report
  const SmallMap = ({ location, address }: { location: any; address?: string }) => {
    if (!location || !location.latitude || !location.longitude) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.noLocationContainer}>
            <Text style={styles.noLocationText}>📍 No Location Data</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingIndicatorColor="#4DB6AC"
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
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
    );
  };

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.reportItem}>
      <Text style={styles.reportTitle}>{item.description.substring(0, 30)}...</Text>
      <Text style={styles.reportInfo}>Category: {categories.find(c => c.value === item.category)?.label}</Text>
      <Text style={styles.reportInfo}>Severity: {severities.find(s => s.value === item.severity)?.label}</Text>
      <Text style={styles.reportInfo}>Status: {item.reportStatus}</Text>
      
      {/* Location Information */}
      <View style={styles.locationSection}>
        <Text style={styles.locationTitle}>📍 Location</Text>
        {item.location ? (
          <View style={styles.locationInfo}>
            <Text style={styles.coordinates}>
              Lat: {item.location.latitude?.toFixed(4) || 'N/A'}, 
              Lon: {item.location.longitude?.toFixed(4) || 'N/A'}
            </Text>
            <Text style={styles.timestamp}>
              Reported: {new Date(item.timestamp).toLocaleString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.noLocationText}>No location data available</Text>
        )}
        
        {/* Small Map View */}
        <SmallMap location={item.location} />
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleView(item)}>
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(item.id)}>
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <BackButton />
      <Text style={styles.title}>Your Reports</Text>
      {reports.length === 0 ? (
        <Text>No reports found</Text>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}

      {/* View Modal */}
      <Modal visible={isViewModalOpen} animationType="slide" onRequestClose={() => setIsViewModalOpen(false)}>
        <ScrollView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Report Details</Text>
          {selectedReport && (
            <>
              <Text style={styles.modalText}>Description: {selectedReport.description}</Text>
              <Text style={styles.modalText}>Category: {categories.find(c => c.value === selectedReport.category)?.label}</Text>
              <Text style={styles.modalText}>Severity: {severities.find(s => s.value === selectedReport.severity)?.label}</Text>
              <Text style={styles.modalText}>Status: {selectedReport.reportStatus}</Text>
              
              {/* Location Information with Map */}
              <View style={styles.modalLocationSection}>
                <Text style={styles.modalLocationTitle}>📍 Location Information</Text>
                <Text style={styles.modalCoordinates}>
                  Lat: {selectedReport.location.latitude.toFixed(4)}, Lon: {selectedReport.location.longitude.toFixed(4)}
                </Text>
                <Text style={styles.modalTimestamp}>
                  Submitted: {new Date(selectedReport.timestamp).toLocaleString()}
                </Text>
                
                {/* Small Map in Modal */}
                <SmallMap location={selectedReport.location} />
              </View>
              
              {selectedReport.media.length > 0 && (
                <Image source={{ uri: selectedReport.media[0].url }} style={styles.modalImage} />
              )}
              <Button title="Close" onPress={() => setIsViewModalOpen(false)} />
            </>
          )}
        </ScrollView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" onRequestClose={() => setIsEditModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Edit Report</Text>
            
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Describe the damage"
              multiline
            />
            <Button title="Pick Image/Video" onPress={pickImage} />
            {editImage && <Image source={{ uri: editImage }} style={styles.modalImage} />}
            
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
                    value={editAddress}
                    onChangeText={setEditAddress}
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
              {editLocation && (
                <View style={styles.locationDisplay}>
                  <Text style={styles.locationDisplayText}>
                    📍 Lat: {editLocation.latitude.toFixed(4)}, Lon: {editLocation.longitude.toFixed(4)}
                  </Text>
                  {editAddress && (
                    <Text style={styles.addressText}>
                      📍 Address: {editAddress}
                    </Text>
                  )}
                  
                  {/* Small Map View */}
                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.map}
                      provider={PROVIDER_GOOGLE}
                      region={{
                        latitude: editLocation.latitude,
                        longitude: editLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      showsUserLocation={true}
                      showsMyLocationButton={false}
                      loadingEnabled={true}
                      loadingIndicatorColor="#4DB6AC"
                    >
                      <Marker
                        coordinate={{
                          latitude: editLocation.latitude,
                          longitude: editLocation.longitude,
                        }}
                        title="Report Location"
                        description={editAddress || "Damage Report Location"}
                      />
                    </MapView>
                  </View>
                </View>
              )}
            </View>
            
            <Text style={styles.label}>Select Category</Text>
            <CustomDropdown
              items={categories}
              selectedValue={editCategory}
              onSelect={setEditCategory}
              placeholder="Choose category"
              style={styles.dropdownWrapper}
            />
            <Text style={styles.label}>Select Severity</Text>
            <CustomDropdown
              items={severities}
              selectedValue={editSeverity}
              onSelect={setEditSeverity}
              placeholder="Choose severity"
              style={styles.dropdownWrapper}
            />
            <View style={styles.modalButtonRow}>
              <Button title="Save" onPress={handleSaveEdit} />
              <Button title="Cancel" color="red" onPress={() => setIsEditModalOpen(false)} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  list: {
    flex: 1,
  },
  reportItem: {
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4DB6AC',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalImage: {
    width: 200,
    height: 200,
    marginVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#4DB6AC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  locationText: {
    marginVertical: 8,
    fontSize: 14,
    fontStyle: 'italic',
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
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  // New styles for enhanced location functionality
  reportInfo: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  locationSection: {
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2F1',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 8,
  },
  locationInfo: {
    marginBottom: 12,
  },
  coordinates: {
    fontSize: 14,
    color: '#4DB6AC',
    fontWeight: '500',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  mapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4DB6AC',
    backgroundColor: '#E8F4FD',
  },
  map: {
    flex: 1,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  noLocationText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Modal specific styles
  modalText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  modalLocationSection: {
    marginVertical: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2F1',
  },
  modalLocationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 8,
  },
  modalCoordinates: {
    fontSize: 14,
    color: '#4DB6AC',
    fontWeight: '500',
    marginBottom: 4,
  },
  modalTimestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  // Enhanced location section styles (same as report.tsx)
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
  locationDisplayText: {
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
});
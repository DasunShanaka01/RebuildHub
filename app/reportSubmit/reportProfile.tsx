import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Image, Button, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
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
          <View style={styles.dropdownModalContent}>
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

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high': return '#DC2626';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#64748B';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'approved': return '#10B981';
    case 'rejected': return '#DC2626';
    default: return '#64748B';
  }
};

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser && id) {
        setUser({ uid: id } as User);
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
      // Only attempt reverse geocoding when online
      try {
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (reverseGeocode.length > 0) {
            const addr = reverseGeocode[0];
            const fullAddress = `${addr.street || ''} ${addr.city || ''} ${addr.region || ''} ${addr.country || ''}`.trim();
            setEditAddress(fullAddress);
          }
        } else {
          console.log('Offline - skipping reverse geocode in edit view');
        }
      } catch (geErr) {
        console.warn('Reverse geocode in edit view failed:', (geErr as any).message || geErr);
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
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert('Offline', 'Cannot geocode address while offline. Please connect to the internet and try again.');
        return;
      }
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
      fetchReports();
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
              fetchReports();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete report: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const SmallMap = ({ location, address }: { location: any; address?: string }) => {
    if (!location || !location.latitude || !location.longitude) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.noLocationContainer}>
            <Text style={styles.noLocationIcon}>📍</Text>
            <Text style={styles.noLocationText}>No Location Data</Text>
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
          loadingIndicatorColor="#2563EB"
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
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle} numberOfLines={2}>
          {item.description.substring(0, 50)}...
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.reportStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.reportStatus) }]}>
            {item.reportStatus.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.reportDetails}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>
              {categories.find(c => c.value === item.category)?.label || item.category}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Severity</Text>
            <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
              <Text style={styles.severityText}>
                {severities.find(s => s.value === item.severity)?.label || item.severity}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.locationPreviewSection}>
          <Text style={styles.locationLabel}>Location</Text>
          {item.location ? (
            <>
              <Text style={styles.coordinates}>
                {item.location.latitude?.toFixed(4)}, {item.location.longitude?.toFixed(4)}
              </Text>
              <SmallMap location={item.location} />
            </>
          ) : (
            <Text style={styles.noLocationText}>No location data</Text>
          )}
        </View>

        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.viewButton} onPress={() => handleView(item)}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <BackButton />
      <Text style={styles.title}>My Reports</Text>
      <Text style={styles.subtitle}>{reports.length} report{reports.length !== 1 ? 's' : ''} submitted</Text>
      
      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptyText}>Your submitted disaster reports will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* View Modal */}
      <Modal visible={isViewModalOpen} animationType="slide" onRequestClose={() => setIsViewModalOpen(false)}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setIsViewModalOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedReport && (
              <View style={styles.modalContent}>
                <View style={[styles.statusBadge, styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedReport.reportStatus) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(selectedReport.reportStatus) }]}>
                    {selectedReport.reportStatus.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Description</Text>
                  <Text style={styles.modalText}>{selectedReport.description}</Text>
                </View>

                <View style={styles.modalDetailGrid}>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalLabel}>Category</Text>
                    <Text style={styles.modalValue}>
                      {categories.find(c => c.value === selectedReport.category)?.label}
                    </Text>
                  </View>
                  <View style={styles.modalDetailItem}>
                    <Text style={styles.modalLabel}>Severity</Text>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(selectedReport.severity) }]}>
                      <Text style={styles.severityText}>
                        {severities.find(s => s.value === selectedReport.severity)?.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Location</Text>
                  <Text style={styles.modalCoordinates}>
                    {selectedReport.location.latitude.toFixed(4)}, {selectedReport.location.longitude.toFixed(4)}
                  </Text>
                  <SmallMap location={selectedReport.location} />
                </View>

                {selectedReport.media.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Media</Text>
                    <Image source={{ uri: selectedReport.media[0].url }} style={styles.modalImage} />
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalTimestamp}>
                    Submitted on {new Date(selectedReport.timestamp).toLocaleDateString()} at {new Date(selectedReport.timestamp).toLocaleTimeString()}
                  </Text>
                </View>

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsViewModalOpen(false)}>
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" onRequestClose={() => setIsEditModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Report</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editFormContent}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={styles.textArea}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Describe the damage..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Category *</Text>
              <CustomDropdown
                items={categories}
                selectedValue={editCategory}
                onSelect={setEditCategory}
                placeholder="Select category"
                style={styles.dropdownWrapper}
              />

              <Text style={styles.inputLabel}>Severity *</Text>
              <CustomDropdown
                items={severities}
                selectedValue={editSeverity}
                onSelect={setEditSeverity}
                placeholder="Select severity"
                style={styles.dropdownWrapper}
              />

              <Text style={styles.inputLabel}>Media (Optional)</Text>
              <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                <Text style={styles.mediaButtonIcon}>📷</Text>
                <Text style={styles.mediaButtonText}>
                  {editImage ? 'Change Media' : 'Add Photo/Video'}
                </Text>
              </TouchableOpacity>
              {editImage && <Image source={{ uri: editImage }} style={styles.editImage} />}

              <View style={styles.locationEditSection}>
                <Text style={styles.sectionTitle}>Location *</Text>
                
                <View style={styles.locationButtonGroup}>
                  <TouchableOpacity style={styles.primaryButton} onPress={getLocation}>
                    <Text style={styles.primaryButtonText}>📍 Current</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={() => setShowLocationInput(!showLocationInput)}
                  >
                    <Text style={styles.secondaryButtonText}>✏️ Manual</Text>
                  </TouchableOpacity>
                </View>

                {showLocationInput && (
                  <View style={styles.manualInputSection}>
                    <Text style={styles.inputLabel}>Search Address</Text>
                    <View style={styles.addressInputGroup}>
                      <TextInput
                        style={styles.addressInput}
                        value={editAddress}
                        onChangeText={setEditAddress}
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

                {editLocation && (
                  <View style={styles.locationPreview}>
                    <Text style={styles.coordDisplay}>
                      📌 {editLocation.latitude.toFixed(4)}, {editLocation.longitude.toFixed(4)}
                    </Text>
                    {editAddress && <Text style={styles.addressDisplay}>{editAddress}</Text>}
                    <View style={styles.mapWrapper}>
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
                        loadingIndicatorColor="#2563EB"
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

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditModalOpen(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#F1F5F9',
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 8,
    lineHeight: 24,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationPreviewSection: {
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  coordinates: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  mapContainer: {
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  noLocationIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewButton: {
    flex: 2,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  editButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  modalSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  modalDetailGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalDetailItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  modalLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  modalCoordinates: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
    marginBottom: 12,
  },
  modalImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    marginTop: 8,
  },
  modalTimestamp: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  modalCloseButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editFormContent: {
    padding: 16,
  },
  inputLabel: {
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
  dropdownModalContent: {
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
  editImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 16,
  },
  locationEditSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  addressDisplay: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  mapWrapper: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  saveButton: {
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
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
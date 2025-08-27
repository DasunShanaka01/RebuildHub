import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Image, Button, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth, db } from '../../FirebaseConfig';
import BackButton from '../../components/BackButton';

const CLOUDINARY_CONFIG = {
  cloudName: 'dkp01emhb',
  uploadPreset: 'adadadad', // Replace with your actual Cloudinary upload preset
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
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setEditLocation(loc.coords);
    Alert.alert('Location Captured', `Lat: ${loc.coords.latitude}, Lon: ${loc.coords.longitude}`);
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

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.reportItem}>
      <Text style={styles.reportTitle}>{item.description.substring(0, 30)}...</Text>
      <Text>Category: {categories.find(c => c.value === item.category)?.label}</Text>
      <Text>Severity: {severities.find(s => s.value === item.severity)?.label}</Text>
      <Text>Status: {item.reportStatus}</Text>
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
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Report Details</Text>
          {selectedReport && (
            <>
              <Text>Description: {selectedReport.description}</Text>
              <Text>Category: {categories.find(c => c.value === selectedReport.category)?.label}</Text>
              <Text>Severity: {severities.find(s => s.value === selectedReport.severity)?.label}</Text>
              <Text>Status: {selectedReport.reportStatus}</Text>
              <Text>
                Location: Lat: {selectedReport.location.latitude.toFixed(4)}, Lon: {selectedReport.location.longitude.toFixed(4)}
              </Text>
              <Text>Submitted: {new Date(selectedReport.timestamp).toLocaleString()}</Text>
              {selectedReport.media.length > 0 && (
                <Image source={{ uri: selectedReport.media[0].url }} style={styles.modalImage} />
              )}
              <Button title="Close" onPress={() => setIsViewModalOpen(false)} />
            </>
          )}
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" onRequestClose={() => setIsEditModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
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
          <Button title="Get Location" onPress={getLocation} />
          {editLocation && (
            <Text style={styles.locationText}>
              Lat: {editLocation.latitude.toFixed(4)}, Lon: {editLocation.longitude.toFixed(4)}
            </Text>
          )}
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
});
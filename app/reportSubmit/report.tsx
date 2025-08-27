import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
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
  const [user, setUser] = useState<User | null>(null);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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

  // Auto-sync offline reports
  const syncOfflineReports = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const reportKeys = keys.filter((key) => key.startsWith('report-'));
      const reports = await AsyncStorage.multiGet(reportKeys);

      for (const [key, value] of reports) {
        if (value) {
          const report = JSON.parse(value);
          const userId = report.userId;
          let mediaItem: MediaItem | null = null;

          if (report.image) {
            if (typeof report.image === 'string') {
              mediaItem = await uploadToCloudinary(report.image, userId);
            } else {
              console.warn(`Skipping invalid image data for report ${key}`);
              continue;
            }
          }

          await addDoc(collection(db, 'reportData'), {
            ...report,
            media: mediaItem ? [mediaItem] : [],
            reportStatus: report.reportStatus || 'pending', // Ensure status is included
          });

          await AsyncStorage.removeItem(key);
          console.log(`Synced and removed report: ${key}`);
        }
      }
      if (reportKeys.length > 0) {
        Alert.alert('Success', 'All offline reports synced to database.');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync offline reports: ' + error.message);
    }
  };

  useEffect(() => {
    // Monitor auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser && id) {
        setUser({ uid: id } as User); // Fallback to id if no user is logged in
      }
    });

    // Monitor network status and sync when online
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
      if (state.isConnected) {
        syncOfflineReports();
      }
    });

    // Initial sync attempt on mount
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        syncOfflineReports();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeNet();
    };
  }, [id]);

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    Alert.alert('Location Captured', `Lat: ${loc.coords.latitude}, Lon: ${loc.coords.longitude}`);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: false, // Explicitly disable multiple selection
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
      reportStatus: 'pending', // Set initial status to pending
    };

    try {
      if (isOffline) {
        // Store report offline
        await AsyncStorage.setItem(`report-${Date.now()}`, JSON.stringify({ ...reportData, image }));
        Alert.alert('Success', 'Report saved offline. Will sync when online.');
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
    setCategory(null);
    setSeverity(null);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      
      <BackButton />
      
      <Text style={styles.title}>Damage Reporting</Text>
      <Text style={styles.userText}>User: {user?.email || `User-${id}`}</Text>
      <TextInput
        style={[styles.input, { height: 80 }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the damage"
        multiline
      />
      <Button title="Pick Image/Video" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.imagePreview} />}
      <Button title="Get Location" onPress={getLocation} />
      {location && (
        <Text style={styles.locationText}>
          Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}
        </Text>
      )}
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
      <Text style={styles.statusText}>Status: {isOffline ? 'Offline' : 'Online'}</Text>
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


import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../FirebaseConfig';

const CLOUDINARY_CONFIG = {
  cloudName: 'dkp01emhb',
  uploadPreset: 'adadadad',
};


interface MediaItem {
  id: string;         // Firestore document ID
  url: string;        // Cloudinary URL of the uploaded media
  userId: string;     // ID of the user who uploaded
  uploadedAt: Date;   // Date when the media was uploaded
  filename: string;   // Original filename of the uploaded media
}


// Custom Dropdown Component
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
  const { id } = useLocalSearchParams();
  const [userName, setUserName] = useState('');
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

  useEffect(() => {
    setUserName(`User-${id}`);
    // Monitor network status
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
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
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!description || !category || !severity || !location) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const reportData = {
      userName,
      description,
      category,
      severity,
      location,
      image,
      timestamp: new Date(),
    };

    try {
      if (isOffline) {
        // Store report offline
        await AsyncStorage.setItem(`report-${Date.now()}`, JSON.stringify(reportData));
        Alert.alert('Success', 'Report saved offline. Will sync when online.');
      } else {
        // Upload image to Firebase Storage if present
        // let imageURL = null;
        // if (image) {
        //   const response = await fetch(image);
        //   const blob = await response.blob();
        //   const imageRef = ref(storage, `reports/${id}/${Date.now()}`);
        //   await uploadBytes(imageRef, blob);
        //   imageURL = await getDownloadURL(imageRef);
        // }

        // Save report to Firestore
        // await addDoc(collection(db, 'reportData'), {
        //   ...reportData,
        //   imageURL,
        // });
        // Alert.alert('Success', 'Damage Report Submitted');
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
    setUserName(`User-${id}`);
    setDescription('');
    setImage(null);
    setLocation(null);
    setCategory(null);
    setSeverity(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>Damage Reporting</Text>
      <TextInput
        style={styles.input}
        value={userName}
        onChangeText={setUserName}
        placeholder="Enter your name"
      />
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
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '@/FirebaseConfig';

interface AidRequestForm {
  fullName: string;
  identifier: string;
  householdSize: string;
  address: string;
  gpsLocation: string;
  aidTypes: {
    food: boolean;
    water: boolean;
    medicine: boolean;
    shelter: boolean;
    other: string;
  };
  urgencyLevel: 'Low' | 'Medium' | 'High';
  additionalNotes: string;
}

export default function AidScreen() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AidRequestForm>({
    fullName: '',
    identifier: '',
    householdSize: '',
    address: '',
    gpsLocation: '',
    aidTypes: {
      food: false,
      water: false,
      medicine: false,
      shelter: false,
      other: '',
    },
    urgencyLevel: 'Medium',
    additionalNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    } catch (error) {
      console.log('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      if (!locationPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please grant location permission to auto-capture GPS coordinates.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Grant Permission', onPress: checkLocationPermission }
          ]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const gpsString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setFormData(prev => ({ ...prev, gpsLocation: gpsString }));

      Alert.alert('Success', `GPS Location captured: ${gpsString}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please enter manually.');
      console.error('Error getting location:', error);
    }
  };

  const handleInputChange = (field: keyof AidRequestForm, value: string | 'Low' | 'Medium' | 'High') => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAidTypeChange = (type: keyof AidRequestForm['aidTypes'], value: boolean | string) => {
    setFormData(prev => ({
      ...prev,
      aidTypes: { ...prev.aidTypes, [type]: value }
    }));
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.identifier || !formData.address) {
      Alert.alert('Error', 'Please fill in all required fields (Name, ID/Phone, and Address)');
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'aid_requests'), {
        ...formData,
        status: 'Requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        'Success!',
        `Your request has been submitted. Track with Request ID: ${docRef.id}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowForm(false);
              setFormData({
                fullName: '',
                identifier: '',
                householdSize: '',
                address: '',
                gpsLocation: '',
                aidTypes: {
                  food: false,
                  water: false,
                  medicine: false,
                  shelter: false,
                  other: '',
                },
                urgencyLevel: 'Medium',
                additionalNotes: '',
              });
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
      console.error('Error submitting aid request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'Low': return '#4CAF50';
      case 'Medium': return '#FF9800';
      case 'High': return '#F44336';
      default: return '#FF9800';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Aid</Text>
      <Text style={styles.subtitle}>Request assistance and support resources</Text>
      
      {!showForm ? (
        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.requestButtonText}>Request Aid</Text>
        </TouchableOpacity>
      ) : (
        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aid Request Form</Text>
              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              {/* User Identification */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 User Identification</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name *"
                  value={formData.fullName}
                  onChangeText={(value) => handleInputChange('fullName', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="NIC / National ID OR Phone Number *"
                  value={formData.identifier}
                  onChangeText={(value) => handleInputChange('identifier', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Household Size"
                  value={formData.householdSize}
                  onChangeText={(value) => handleInputChange('householdSize', value)}
                  keyboardType="numeric"
                />
              </View>

              {/* Location Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 Location Details</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Address / Village Name *"
                  value={formData.address}
                  onChangeText={(value) => handleInputChange('address', value)}
                />
                <View style={styles.gpsContainer}>
                  <TextInput
                    style={[styles.input, styles.gpsInput]}
                    placeholder="GPS Location (auto-captured or manual)"
                    value={formData.gpsLocation}
                    onChangeText={(value) => handleInputChange('gpsLocation', value)}
                  />
                  <TouchableOpacity
                    style={styles.gpsButton}
                    onPress={getCurrentLocation}
                  >
                    <Text style={styles.gpsButtonText}>📍</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Aid Request Type */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🆘 Aid Request Type</Text>
                <View style={styles.checkboxRow}>
                  <Switch
                    value={formData.aidTypes.food}
                    onValueChange={(value) => handleAidTypeChange('food', value)}
                  />
                  <Text style={styles.checkboxLabel}>Food</Text>
                </View>
                <View style={styles.checkboxRow}>
                  <Switch
                    value={formData.aidTypes.water}
                    onValueChange={(value) => handleAidTypeChange('water', value)}
                  />
                  <Text style={styles.checkboxLabel}>Water</Text>
                </View>
                <View style={styles.checkboxRow}>
                  <Switch
                    value={formData.aidTypes.medicine}
                    onValueChange={(value) => handleAidTypeChange('medicine', value)}
                  />
                  <Text style={styles.checkboxLabel}>Medicine</Text>
                </View>
                <View style={styles.checkboxRow}>
                  <Switch
                    value={formData.aidTypes.shelter}
                    onValueChange={(value) => handleAidTypeChange('shelter', value)}
                  />
                  <Text style={styles.checkboxLabel}>Shelter / Temporary housing</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Other (specify)"
                  value={formData.aidTypes.other}
                  onChangeText={(value) => handleAidTypeChange('other', value)}
                />
              </View>

              {/* Urgency Level */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🚨 Urgency Level</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.urgencyLevel}
                    onValueChange={(value) => handleInputChange('urgencyLevel', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Low" value="Low" />
                    <Picker.Item label="Medium" value="Medium" />
                    <Picker.Item label="High" value="High" />
                  </Picker>
                  <View style={[styles.urgencyIndicator, { backgroundColor: getUrgencyColor(formData.urgencyLevel) }]} />
                </View>
              </View>

              {/* Additional Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 Additional Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Specific needs, medical conditions, etc."
                  value={formData.additionalNotes}
                  onChangeText={(value) => handleInputChange('additionalNotes', value)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  requestButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  gpsInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  gpsButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    flex: 1,
    height: 50,
  },
  urgencyIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 15,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Picker } from '@react-native-picker/picker';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  /* orderBy, */
  doc,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/FirebaseConfig';

interface AidRequestForm {
  fullName: string;
  nicNumber: string;
  contactNumber: string;
  householdSize: string;
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

interface AidRequest extends AidRequestForm {
  id: string;
  status: 'Requested' | 'Cancelled' | 'In Progress' | 'Delivered';
  createdAt?: any;
  updatedAt?: any;
  userId?: string;
}

export default function AidScreen() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AidRequestForm>({
    fullName: '',
    nicNumber: '',
    contactNumber: '',
    householdSize: '',
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [unsubscribeRequests, setUnsubscribeRequests] = useState<(() => void) | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AidRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    checkLocationPermission();
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setRequests([]);
      if (unsubscribeRequests) {
        unsubscribeRequests();
        setUnsubscribeRequests(null);
      }
      return;
    }
    if (unsubscribeRequests) {
      unsubscribeRequests();
      setUnsubscribeRequests(null);
    }
    const unsub = subscribeToRequests(currentUser.uid);
    if (unsub) setUnsubscribeRequests(() => unsub);
  }, [currentUser?.uid]);

  const subscribeToRequests = (userId: string) => {
    if (!userId) return;
    setIsLoadingRequests(true);
    const q = query(
      collection(db, 'aid_requests'),
      where('userId', '==', userId)
      // Removed orderBy('createdAt', 'desc') to avoid needing a composite index
    );
    return onSnapshot(q, (snapshot) => {
      const list: AidRequest[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AidRequest, 'id'>) }));
      // Exclude cancelled requests
      const visible = list.filter((r) => r.status !== 'Cancelled');
      // Sort client-side by createdAt descending if present
      visible.sort((a, b) => {
        const aTs = a.createdAt?.seconds ?? 0;
        const bTs = b.createdAt?.seconds ?? 0;
        return bTs - aTs;
      });
      setRequests(visible);
      setIsLoadingRequests(false);
    }, (err) => {
      console.error('subscribeToRequests error', err);
      setIsLoadingRequests(false);
    });
  };

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

      // Removed success alert to avoid popup on GPS capture

      // Center the form map on the live location
      try {
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      } catch (e) {
        // noop
      }
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

  const resetForm = () => {
    setFormData({
      fullName: '',
      nicNumber: '',
      contactNumber: '',
      householdSize: '',
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
    setEditingRequestId(null);
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.nicNumber || !formData.contactNumber) {
      Alert.alert('Error', 'Please fill in all required fields (Name, NIC Number, and Contact Number)');
      return;
    }
    if (!currentUser?.uid) {
      Alert.alert('Not signed in', 'Please sign in to submit a request.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRequestId) {
        await updateDoc(doc(db, 'aid_requests', editingRequestId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Updated', 'Your request has been updated.');
      } else {
        const docRef = await addDoc(collection(db, 'aid_requests'), {
          ...formData,
          userId: currentUser.uid,
          status: 'Requested',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        Alert.alert(
          'Success!',
          `Your request has been submitted. Track with Request ID: ${docRef.id}`,
        );
      }

      setShowForm(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
      console.error('Error submitting/updating aid request:', error);
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

  const onPressEdit = (request: AidRequest) => {
    setEditingRequestId(request.id);
    setFormData({
      fullName: request.fullName,
      nicNumber: request.nicNumber,
      contactNumber: request.contactNumber,
      householdSize: request.householdSize,
      gpsLocation: request.gpsLocation,
      aidTypes: { ...request.aidTypes },
      urgencyLevel: request.urgencyLevel,
      additionalNotes: request.additionalNotes,
    });
    setShowForm(true);
  };

  const onPressView = (request: AidRequest) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const onPressCancel = async (request: AidRequest) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this aid request?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          try {
            await updateDoc(doc(db, 'aid_requests', request.id), {
              status: 'Cancelled',
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            Alert.alert('Error', 'Failed to cancel request.');
          }
        }},
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: AidRequest }) => {
    const canEditOrCancel = item.status === 'Requested';
    
    return (
      <TouchableOpacity style={styles.card} onPress={() => onPressView(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.fullName}</Text>
          {canEditOrCancel && (
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => onPressEdit(item)} style={styles.editButton}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onPressCancel(item)} style={styles.cancelButton}>
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: getUrgencyColor(item.urgencyLevel) }]}>
            <Text style={styles.badgeText}>{item.urgencyLevel}</Text>
          </View>
          <View style={[styles.badge, styles.statusBadge]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>NIC: {item.nicNumber} • Contact: {item.contactNumber} • GPS: {item.gpsLocation || 'N/A'}</Text>
        <Text style={styles.cardMeta}>Needs: {['food','water','medicine','shelter']
          .filter((k) => (item.aidTypes as any)[k])
          .join(', ') || 'None'} {item.aidTypes.other ? `, Other: ${item.aidTypes.other}` : ''}</Text>
      </TouchableOpacity>
    );
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
              <Text style={styles.modalTitle}>{editingRequestId ? 'Edit Aid Request' : 'Aid Request Form'}</Text>
              <TouchableOpacity
                onPress={() => { setShowForm(false); resetForm(); }}
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
                  placeholder="NIC Number *"
                  value={formData.nicNumber}
                  onChangeText={(value) => handleInputChange('nicNumber', value)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Contact Number *"
                  value={formData.contactNumber}
                  onChangeText={(value) => handleInputChange('contactNumber', value)}
                  keyboardType="phone-pad"
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
              {(() => {
                const gps = formData.gpsLocation;
                const parts = gps ? gps.split(',').map((p) => p.trim()) : [];
                const lat = parts.length === 2 ? Number(parts[0]) : NaN;
                const lng = parts.length === 2 ? Number(parts[1]) : NaN;
                const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);
                const initialRegion = hasCoords
                  ? { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                  : undefined;
                return (
                  <View style={{ marginTop: 8 }}>
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={initialRegion}
                      onPress={(e) => {
                        const c = e.nativeEvent.coordinate;
                        handleInputChange('gpsLocation', `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`);
                      }}
                    >
                      {hasCoords && (
                        <Marker coordinate={{ latitude: lat, longitude: lng }} />
                      )}
                    </MapView>
                    <Text style={{ color: '#666', marginTop: 6, fontSize: 12 }}>Tap on the map to set location</Text>
                  </View>
                );
              })()}
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
                  {isSubmitting ? (editingRequestId ? 'Updating...' : 'Submitting...') : (editingRequestId ? 'Update Request' : 'Submit Request')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Detail Modal */}
      <Modal
        visible={isDetailOpen}
        animationType="slide"
        onRequestClose={() => setIsDetailOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <TouchableOpacity onPress={() => setIsDetailOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            {selectedRequest && (
              <View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Name</Text>
                  <Text style={styles.detailValue}>{selectedRequest.fullName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NIC Number</Text>
                  <Text style={styles.detailValue}>{selectedRequest.nicNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contact Number</Text>
                  <Text style={styles.detailValue}>{selectedRequest.contactNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>GPS</Text>
                  <Text style={styles.detailValue}>{selectedRequest.gpsLocation || 'N/A'}</Text>
                </View>
                {(() => {
                  const gps = selectedRequest.gpsLocation;
                  const parts = gps ? gps.split(',').map((p) => p.trim()) : [];
                  const lat = parts.length === 2 ? Number(parts[0]) : NaN;
                  const lng = parts.length === 2 ? Number(parts[1]) : NaN;
                  const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
                  if (!valid) return null;
                  return (
                    <View style={{ marginBottom: 16 }}>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: lat,
                          longitude: lng,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        pointerEvents="none"
                      >
                        <Marker coordinate={{ latitude: lat, longitude: lng }} />
                      </MapView>
                    </View>
                  );
                })()}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Household Size</Text>
                  <Text style={styles.detailValue}>{selectedRequest.householdSize || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Urgency</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.detailUrgencyDot, { backgroundColor: getUrgencyColor(selectedRequest.urgencyLevel) }]} />
                    <Text style={[styles.detailValue, { marginLeft: 8 }]}>{selectedRequest.urgencyLevel}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>{selectedRequest.status}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Needs</Text>
                  <Text style={styles.detailValue}>
                    {['food','water','medicine','shelter'].filter(k => (selectedRequest.aidTypes as any)[k]).join(', ') || 'None'}
                    {selectedRequest.aidTypes.other ? `, Other: ${selectedRequest.aidTypes.other}` : ''}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Additional Notes</Text>
                  <Text style={styles.detailValue}>{selectedRequest.additionalNotes || '—'}</Text>
                </View>
                {(selectedRequest.createdAt || selectedRequest.updatedAt) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Timestamps</Text>
                    <Text style={styles.detailValue}>
                      {selectedRequest.createdAt ? `Created: ${new Date((selectedRequest.createdAt.seconds ?? 0) * 1000).toLocaleString()}` : ''}
                      {selectedRequest.updatedAt ? `\nUpdated: ${new Date((selectedRequest.updatedAt.seconds ?? 0) * 1000).toLocaleString()}` : ''}
                    </Text>
                  </View>
                )}
                {selectedRequest.status === 'Requested' && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                    <TouchableOpacity style={[styles.editButton, { flex: 1 }]} onPress={() => { if (selectedRequest) { setIsDetailOpen(false); onPressEdit(selectedRequest); } }}>
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                    <View style={{ width: 12 }} />
                    <TouchableOpacity style={[styles.cancelButton, { flex: 1 }]} onPress={() => { if (selectedRequest) { setIsDetailOpen(false); onPressCancel(selectedRequest); } }}>
                      <Text style={styles.actionText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      {/* Requests List */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionTitle}>Your Requests</Text>
        {currentUser ? (
          <Text style={styles.smallNote}>for {currentUser.email || currentUser.uid}</Text>
        ) : null}
      </View>
      {isLoadingRequests ? (
        <ActivityIndicator size="small" color="#2196F3" />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          style={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No requests yet.</Text>}
          contentContainerStyle={requests.length === 0 ? { flexGrow: 1, justifyContent: 'center', alignItems: 'center' } : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
  },
  list: {
    width: '100%',
    marginHorizontal: -20,
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
    marginBottom: 16,
  },
  requestButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
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
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  detailUrgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  map: {
    width: '100%',
    height: 180,
    borderRadius: 12,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  gpsInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  gpsButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
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
    marginBottom: 10,
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
    height: 44,
  },
  urgencyIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 12,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  smallNote: {
    color: '#666',
    fontSize: 12,
  },
  emptyText: {
    color: '#666',
    marginTop: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 16,
    marginBottom: 10,
    borderColor: '#eee',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    marginLeft: 6,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#C62828',
    marginLeft: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardSub: {
    color: '#555',
    marginBottom: 6,
  },
  cardMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: '#FF9800', // Default to Medium color
  },
});

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
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
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
  rating?: number;
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
  const [pendingRating, setPendingRating] = useState<number>(0);
  const mapRef = useRef<MapView | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

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
    );
    return onSnapshot(q, (snapshot) => {
      const list: AidRequest[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AidRequest, 'id'>) }));
      const visible = list.filter((r) => r.status !== 'Cancelled');
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
      case 'Low': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'High': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Requested': return '#3B82F6';
      case 'In Progress': return '#8B5CF6';
      case 'Delivered': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Requested': return 'time-outline';
      case 'In Progress': return 'hourglass-outline';
      case 'Delivered': return 'checkmark-circle-outline';
      default: return 'help-circle-outline';
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
    setPendingRating(request.rating || 0);
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

  const saveRating = async (requestId: string, rating: number) => {
    try {
      if (selectedRequest?.rating && selectedRequest.rating > 0) {
        Alert.alert('Already rated', 'You have already submitted a rating for this request.');
        return;
      }
      await updateDoc(doc(db, 'aid_requests', requestId), {
        rating,
        updatedAt: serverTimestamp(),
      });
      setSelectedRequest((prev) => prev ? { ...prev, rating } : prev);
      Alert.alert('Thanks!', 'Your feedback has been recorded.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save rating. Please try again.');
    }
  };

  const renderRequestItem = ({ item }: { item: AidRequest }) => {
    const canEditOrCancel = item.status === 'Requested';
    const aidTypesList = ['food','water','medicine','shelter']
      .filter((k) => (item.aidTypes as any)[k])
      .map(k => k.charAt(0).toUpperCase() + k.slice(1));
    
    return (
      <TouchableOpacity 
        style={styles.modernCard} 
        onPress={() => onPressView(item)} 
        activeOpacity={0.7}
      >
        <View style={styles.cardTopSection}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={24} color="#fff" />
            </View>
            <View style={styles.cardTitleSection}>
              <Text style={styles.modernCardTitle}>{item.fullName}</Text>
              <Text style={styles.cardSubtitle}>NIC: {item.nicNumber}</Text>
            </View>
          </View>
          
          <View style={styles.statusRow}>
            <View style={[styles.modernBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Ionicons name={getStatusIcon(item.status) as any} size={14} color="#fff" />
              <Text style={styles.modernBadgeText}>{item.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.contactNumber}</Text>
          </View>
          
          {item.gpsLocation && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText} numberOfLines={1}>{item.gpsLocation}</Text>
            </View>
          )}

          {aidTypesList.length > 0 && (
            <View style={styles.aidTypesContainer}>
              {aidTypesList.map((type, idx) => (
                <View key={idx} style={styles.aidTypeChip}>
                  <Text style={styles.aidTypeText}>{type}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.urgencyRow}>
            <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgencyLevel) + '20' }]}>
              <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(item.urgencyLevel) }]} />
              <Text style={[styles.urgencyText, { color: getUrgencyColor(item.urgencyLevel) }]}>
                {item.urgencyLevel} Priority
              </Text>
            </View>
            
            {typeof item.rating === 'number' && (
              <View style={styles.ratingBadge}>
                <FontAwesome name="star" size={14} color="#FFC107" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        {canEditOrCancel && (
          <View style={styles.cardActions}>
            <TouchableOpacity 
              onPress={() => onPressEdit(item)} 
              style={styles.modernEditButton}
            >
              <MaterialIcons name="edit" size={16} color="#3B82F6" />
              <Text style={styles.modernEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => onPressCancel(item)} 
              style={styles.modernCancelButton}
            >
              <MaterialIcons name="cancel" size={16} color="#EF4444" />
              <Text style={styles.modernCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Emergency Aid</Text>
            <Text style={styles.headerSubtitle}>Request assistance and support</Text>
          </View>
          <View style={styles.emergencyIcon}>
            <Ionicons name="medical" size={32} color="#EF4444" />
          </View>
        </View>
        
        {!showForm && (
          <TouchableOpacity
            style={styles.modernRequestButton}
            onPress={() => setShowForm(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.modernRequestButtonText}>New Aid Request</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {showForm && (
        <Modal
          visible={showForm}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modernModalHeader}>
              <View>
                <Text style={styles.modernModalTitle}>
                  {editingRequestId ? 'Edit Request' : 'New Aid Request'}
                </Text>
                <Text style={styles.modernModalSubtitle}>Fill in the details below</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setShowForm(false); resetForm(); }}
                style={styles.modernCloseButton}
              >
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="person-outline" size={20} color="#3B82F6" />
                  <Text style={styles.modernSectionTitle}>Personal Information</Text>
                </View>
                
                <View style={styles.modernInputContainer}>
                  <MaterialIcons name="person" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Full Name *"
                    placeholderTextColor="#9CA3AF"
                    value={formData.fullName}
                    onChangeText={(value) => handleInputChange('fullName', value)}
                  />
                </View>

                <View style={styles.modernInputContainer}>
                  <MaterialIcons name="credit-card" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="NIC Number *"
                    placeholderTextColor="#9CA3AF"
                    value={formData.nicNumber}
                    onChangeText={(value) => handleInputChange('nicNumber', value)}
                  />
                </View>

                <View style={styles.modernInputContainer}>
                  <Ionicons name="call" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Contact Number *"
                    placeholderTextColor="#9CA3AF"
                    value={formData.contactNumber}
                    onChangeText={(value) => handleInputChange('contactNumber', value)}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.modernInputContainer}>
                  <MaterialIcons name="people" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Household Size"
                    placeholderTextColor="#9CA3AF"
                    value={formData.householdSize}
                    onChangeText={(value) => handleInputChange('householdSize', value)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="location" size={20} color="#3B82F6" />
                  <Text style={styles.modernSectionTitle}>Location</Text>
                </View>
                
                <View style={styles.gpsRow}>
                  <View style={[styles.modernInputContainer, { flex: 1 }]}>
                    <Ionicons name="navigate" size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="GPS Coordinates"
                      placeholderTextColor="#9CA3AF"
                      value={formData.gpsLocation}
                      onChangeText={(value) => handleInputChange('gpsLocation', value)}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.modernGpsButton}
                    onPress={getCurrentLocation}
                  >
                    <Ionicons name="locate" size={20} color="#fff" />
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
                    <View style={styles.mapContainer}>
                      <MapView
                        ref={mapRef}
                        style={styles.modernMap}
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
                      <Text style={styles.mapHint}>Tap on the map to set location</Text>
                    </View>
                  );
                })()}
              </View>

              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="medkit" size={20} color="#3B82F6" />
                  <Text style={styles.modernSectionTitle}>Aid Type</Text>
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="fast-food-outline" size={20} color="#6B7280" />
                    <Text style={styles.switchText}>Food</Text>
                  </View>
                  <Switch
                    value={formData.aidTypes.food}
                    onValueChange={(value) => handleAidTypeChange('food', value)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={formData.aidTypes.food ? '#3B82F6' : '#f4f3f4'}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="water-outline" size={20} color="#6B7280" />
                    <Text style={styles.switchText}>Water</Text>
                  </View>
                  <Switch
                    value={formData.aidTypes.water}
                    onValueChange={(value) => handleAidTypeChange('water', value)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={formData.aidTypes.water ? '#3B82F6' : '#f4f3f4'}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="medical-outline" size={20} color="#6B7280" />
                    <Text style={styles.switchText}>Medicine</Text>
                  </View>
                  <Switch
                    value={formData.aidTypes.medicine}
                    onValueChange={(value) => handleAidTypeChange('medicine', value)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={formData.aidTypes.medicine ? '#3B82F6' : '#f4f3f4'}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchLabel}>
                    <Ionicons name="home-outline" size={20} color="#6B7280" />
                    <Text style={styles.switchText}>Shelter</Text>
                  </View>
                  <Switch
                    value={formData.aidTypes.shelter}
                    onValueChange={(value) => handleAidTypeChange('shelter', value)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={formData.aidTypes.shelter ? '#3B82F6' : '#f4f3f4'}
                  />
                </View>

                <View style={styles.modernInputContainer}>
                  <MaterialIcons name="more-horiz" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Other (specify)"
                    placeholderTextColor="#9CA3AF"
                    value={formData.aidTypes.other}
                    onChangeText={(value) => handleAidTypeChange('other', value)}
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="alert-circle" size={20} color="#3B82F6" />
                  <Text style={styles.modernSectionTitle}>Urgency Level</Text>
                </View>
                
                <View style={styles.urgencyPicker}>
                  <Picker
                    selectedValue={formData.urgencyLevel}
                    onValueChange={(value) => handleInputChange('urgencyLevel', value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Low Priority" value="Low" />
                    <Picker.Item label="Medium Priority" value="Medium" />
                    <Picker.Item label="High Priority" value="High" />
                  </Picker>
                  <View style={[styles.urgencyIndicatorLarge, { backgroundColor: getUrgencyColor(formData.urgencyLevel) }]} />
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="note" size={20} color="#3B82F6" />
                  <Text style={styles.modernSectionTitle}>Additional Notes</Text>
                </View>
                
                <View style={[styles.modernInputContainer, styles.textAreaContainer]}>
                  <TextInput
                    style={[styles.modernInput, styles.textArea]}
                    placeholder="Specific needs, medical conditions, etc."
                    placeholderTextColor="#9CA3AF"
                    value={formData.additionalNotes}
                    onChangeText={(value) => handleInputChange('additionalNotes', value)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modernSubmitButton, isSubmitting && styles.modernSubmitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.modernSubmitButtonText}>
                      {editingRequestId ? 'Update Request' : 'Submit Request'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      <Modal
        visible={isDetailOpen}
        animationType="slide"
        onRequestClose={() => setIsDetailOpen(false)}
      >
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modernModalHeader}>
            <View>
              <Text style={styles.modernModalTitle}>Request Details</Text>
              <Text style={styles.modernModalSubtitle}>View your aid request</Text>
            </View>
            <TouchableOpacity onPress={() => setIsDetailOpen(false)} style={styles.modernCloseButton}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            {selectedRequest && (
              <View>
                <View style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View style={styles.avatarCircleLarge}>
                      <MaterialIcons name="person" size={32} color="#fff" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.detailName}>{selectedRequest.fullName}</Text>
                      <Text style={styles.detailSubtext}>NIC: {selectedRequest.nicNumber}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusBanner, { backgroundColor: getStatusColor(selectedRequest.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(selectedRequest.status) as any} size={24} color={getStatusColor(selectedRequest.status)} />
                    <Text style={[styles.statusBannerText, { color: getStatusColor(selectedRequest.status) }]}>
                      {selectedRequest.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Ionicons name="call" size={20} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.detailLabel}>Contact Number</Text>
                      <Text style={styles.detailValue}>{selectedRequest.contactNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <MaterialIcons name="people" size={20} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.detailLabel}>Household Size</Text>
                      <Text style={styles.detailValue}>{selectedRequest.householdSize || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="alert-circle" size={20} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.detailLabel}>Urgency Level</Text>
                      <View style={styles.urgencyDetailRow}>
                        <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(selectedRequest.urgencyLevel) }]} />
                        <Text style={[styles.detailValue, { color: getUrgencyColor(selectedRequest.urgencyLevel), fontWeight: '600' }]}>
                          {selectedRequest.urgencyLevel} Priority
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={20} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.detailLabel}>GPS Location</Text>
                      <Text style={styles.detailValue}>{selectedRequest.gpsLocation || 'N/A'}</Text>
                    </View>
                  </View>

                  {(() => {
                    const gps = selectedRequest.gpsLocation;
                    const parts = gps ? gps.split(',').map((p) => p.trim()) : [];
                    const lat = parts.length === 2 ? Number(parts[0]) : NaN;
                    const lng = parts.length === 2 ? Number(parts[1]) : NaN;
                    const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
                    if (!valid) return null;
                    return (
                      <View style={styles.mapContainer}>
                        <MapView
                          style={styles.modernMap}
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
                    <Ionicons name="medkit" size={20} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.detailLabel}>Aid Types Needed</Text>
                      <View style={styles.aidTypesDetailContainer}>
                        {['food','water','medicine','shelter'].filter(k => (selectedRequest.aidTypes as any)[k]).map((type, idx) => (
                          <View key={idx} style={styles.aidTypeChipDetail}>
                            <Text style={styles.aidTypeTextDetail}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                          </View>
                        ))}
                        {selectedRequest.aidTypes.other && (
                          <View style={styles.aidTypeChipDetail}>
                            <Text style={styles.aidTypeTextDetail}>Other: {selectedRequest.aidTypes.other}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {selectedRequest.additionalNotes && (
                    <View style={styles.detailRow}>
                      <MaterialIcons name="note" size={20} color="#6B7280" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.detailLabel}>Additional Notes</Text>
                        <Text style={styles.detailValue}>{selectedRequest.additionalNotes}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {selectedRequest.status === 'Delivered' && (
                  <View style={styles.ratingSection}>
                    <Text style={styles.ratingSectionTitle}>Rate Your Experience</Text>
                    <View style={styles.starsContainer}>
                      {[1,2,3,4,5].map((star) => {
                        const interactive = !(selectedRequest.rating && selectedRequest.rating > 0);
                        const isFilled = (selectedRequest.rating && selectedRequest.rating > 0)
                          ? (selectedRequest.rating >= star)
                          : (pendingRating >= star);
                        const StarComp = (
                          <FontAwesome
                            name={isFilled ? 'star' : 'star-o'}
                            size={32}
                            color={isFilled ? '#FFC107' : '#D1D5DB'}
                          />
                        );
                        return interactive ? (
                          <TouchableOpacity
                            key={star}
                            onPress={() => setPendingRating(star)}
                            style={styles.starButton}
                            activeOpacity={0.7}
                          >
                            {StarComp}
                          </TouchableOpacity>
                        ) : (
                          <View key={star} style={styles.starButton}>
                            {StarComp}
                          </View>
                        );
                      })}
                    </View>
                    {!(selectedRequest.rating && selectedRequest.rating > 0) && pendingRating > 0 && (
                      <TouchableOpacity
                        onPress={() => saveRating(selectedRequest.id, pendingRating)}
                        style={styles.modernSubmitButton}
                        disabled={pendingRating === 0}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.modernSubmitButtonText}>Submit Rating</Text>
                      </TouchableOpacity>
                    )}
                    {selectedRequest.rating && (
                      <Text style={styles.ratingConfirmation}>
                        You rated this request {selectedRequest.rating} / 5 stars
                      </Text>
                    )}
                  </View>
                )}

                {(selectedRequest.createdAt || selectedRequest.updatedAt) && (
                  <View style={styles.timestampSection}>
                    <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                    <View style={{ marginLeft: 8 }}>
                      {selectedRequest.createdAt && (
                        <Text style={styles.timestampText}>
                          Created: {new Date((selectedRequest.createdAt.seconds ?? 0) * 1000).toLocaleString()}
                        </Text>
                      )}
                      {selectedRequest.updatedAt && (
                        <Text style={styles.timestampText}>
                          Updated: {new Date((selectedRequest.updatedAt.seconds ?? 0) * 1000).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {selectedRequest.status === 'Requested' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.actionButtonEdit} 
                      onPress={() => { 
                        if (selectedRequest) { 
                          setIsDetailOpen(false); 
                          onPressEdit(selectedRequest); 
                        } 
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="edit" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Edit Request</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionButtonCancel} 
                      onPress={() => { 
                        if (selectedRequest) { 
                          setIsDetailOpen(false); 
                          onPressCancel(selectedRequest); 
                        } 
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="cancel" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Cancel Request</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>Your Requests</Text>
            {currentUser && (
              <Text style={styles.listSubtitle}>{currentUser.email || currentUser.uid}</Text>
            )}
          </View>
          {requests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{requests.length}</Text>
            </View>
          )}
        </View>

        {isLoadingRequests ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestItem}
            style={styles.list}
            contentContainerStyle={requests.length === 0 ? styles.emptyListContainer : styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No Requests Yet</Text>
                <Text style={styles.emptyStateText}>
                  Tap "New Aid Request" to submit your first request
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 4,
  },
  emergencyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernRequestButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modernRequestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modernModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  modernModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  modernModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modernCloseButton: {
    padding: 4,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  formSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernSectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  modernInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernGpsButton: {
    backgroundColor: '#10B981',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapContainer: {
    marginTop: 8,
  },
  modernMap: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapHint: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    fontWeight: '500',
  },
  urgencyPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingRight: 12,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  urgencyIndicatorLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  modernSubmitButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modernSubmitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  modernSubmitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
  listSection: {
    flex: 1,
    paddingTop: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  listSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  cardTopSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircleLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleSection: {
    flex: 1,
    marginLeft: 12,
  },
  modernCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modernBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  aidTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
  },
  aidTypeChip: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  aidTypeText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  urgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '700',
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modernEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
  },
  modernEditText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modernCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 6,
  },
  modernCancelText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  detailCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  detailName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  detailSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  detailSection: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  urgencyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aidTypesDetailContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  aidTypeChipDetail: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  aidTypeTextDetail: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '600',
  },
  ratingSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  ratingSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    marginHorizontal: 4,
  },
  ratingConfirmation: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 12,
  },
  timestampSection: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  timestampText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  actionButtonEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 8,
  },
  actionButtonCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});

 
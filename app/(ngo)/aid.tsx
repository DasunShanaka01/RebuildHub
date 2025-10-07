import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import MapView, { Marker } from 'react-native-maps';
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

export default function NgoAidScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<AidRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [unsubscribeRequests, setUnsubscribeRequests] = useState<(() => void) | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

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
    const unsub = subscribeToAllRequests();
    if (unsub) setUnsubscribeRequests(() => unsub);
  }, [currentUser?.uid]);

  const subscribeToAllRequests = () => {
    if (!currentUser) return;
    setIsLoadingRequests(true);
    const q = query(
      collection(db, 'aid_requests'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const list: AidRequest[] = snapshot.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as Omit<AidRequest, 'id'>) 
      }));
      setRequests(list);
      setIsLoadingRequests(false);
    }, (err) => {
      console.error('subscribeToAllRequests error', err);
      setIsLoadingRequests(false);
    });
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
      case 'Cancelled': return '#6B7280';
      default: return '#6B7280';
    }
  }; 

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Requested': return 'time-outline';
      case 'In Progress': return 'hourglass-outline';
      case 'Delivered': return 'checkmark-circle-outline';
      case 'Cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'aid_requests', requestId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', `Request status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update request status');
      console.error('Error updating request status:', error);
    }
  };

  const deleteRequest = async (requestId: string) => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to permanently delete this request? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'aid_requests', requestId));
              Alert.alert('Success', 'Request has been deleted');
              setIsDetailOpen(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete request');
              console.error('Error deleting request:', error);
            }
          }
        },
      ]
    );
  };

  const onPressView = (request: AidRequest) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const filteredRequests = statusFilter === 'All' 
    ? requests 
    : requests.filter(request => request.status === statusFilter);

  const renderRequestItem = ({ item }: { item: AidRequest }) => {
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

          {item.createdAt && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {new Date((item.createdAt.seconds ?? 0) * 1000).toLocaleDateString()} at{' '}
                {new Date((item.createdAt.seconds ?? 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
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

        <View style={styles.cardActions}>
          {item.status === 'Requested' && (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                updateRequestStatus(item.id, 'In Progress');
              }} 
              style={styles.actionButtonProgress}
            >
              <Ionicons name="play-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Start</Text>
            </TouchableOpacity>
          )}
          {item.status === 'In Progress' && (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                updateRequestStatus(item.id, 'Delivered');
              }} 
              style={styles.actionButtonDeliver}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Deliver</Text>
            </TouchableOpacity>
          )}
          {item.status === 'Delivered' && (
            <View style={styles.actionButtonDelivered}>
              <Ionicons name="checkmark-done" size={16} color="#10B981" />
              <Text style={styles.actionButtonTextDelivered}>Completed</Text>
            </View>
          )}
          {item.status !== 'Delivered' && item.status !== 'Cancelled' && (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                updateRequestStatus(item.id, 'Cancelled');
              }} 
              style={styles.actionButtonCancel}
            >
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={styles.actionButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          )}
          {item.status === 'Cancelled' && (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                deleteRequest(item.id);
              }} 
              style={styles.actionButtonDelete}
            >
              <MaterialIcons name="delete" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Aid Management</Text>
            <Text style={styles.headerSubtitle}>Manage and track all aid requests</Text>
          </View>
          <View style={styles.ngoIcon}>
            <MaterialIcons name="volunteer-activism" size={32} color="#3B82F6" />
          </View>
        </View>
        
        {/* Stats Cards */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContainer}
        >
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'All' && styles.statCardActive]}
            onPress={() => setStatusFilter('All')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <MaterialIcons name="list-alt" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'All' && styles.statNumberActive]}>
              {requests.length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'All' && styles.statLabelActive]}>
              All Requests
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'Requested' && styles.statCardActive]}
            onPress={() => setStatusFilter('Requested')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="time" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'Requested' && styles.statNumberActive]}>
              {requests.filter(r => r.status === 'Requested').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'Requested' && styles.statLabelActive]}>
              New
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'In Progress' && styles.statCardActive]}
            onPress={() => setStatusFilter('In Progress')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="hourglass" size={24} color="#8B5CF6" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'In Progress' && styles.statNumberActive]}>
              {requests.filter(r => r.status === 'In Progress').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'In Progress' && styles.statLabelActive]}>
              In Progress
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'Delivered' && styles.statCardActive]}
            onPress={() => setStatusFilter('Delivered')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'Delivered' && styles.statNumberActive]}>
              {requests.filter(r => r.status === 'Delivered').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'Delivered' && styles.statLabelActive]}>
              Delivered
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              {statusFilter === 'All' ? 'All Requests' : `${statusFilter} Requests`}
            </Text>
            <Text style={styles.listSubtitle}>{filteredRequests.length} total</Text>
          </View>
        </View>

        {isLoadingRequests ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestItem}
            style={styles.list}
            contentContainerStyle={filteredRequests.length === 0 ? styles.emptyListContainer : styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons 
                  name={statusFilter === 'All' ? "document-text-outline" : "filter-outline"} 
                  size={64} 
                  color="#D1D5DB" 
                />
                <Text style={styles.emptyStateTitle}>
                  {statusFilter === 'All' ? 'No Requests Yet' : `No ${statusFilter} Requests`}
                </Text>
                <Text style={styles.emptyStateText}>
                  {statusFilter === 'All' 
                    ? 'Aid requests will appear here once submitted by users'
                    : `There are currently no ${statusFilter.toLowerCase()} requests`
                  }
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Detail Modal */}
      <Modal
        visible={isDetailOpen}
        animationType="slide"
        onRequestClose={() => setIsDetailOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modernModalHeader}>
            <View>
              <Text style={styles.modernModalTitle}>Request Details</Text>
              <Text style={styles.modernModalSubtitle}>View and manage request</Text>
            </View>
            <TouchableOpacity onPress={() => setIsDetailOpen(false)} style={styles.modernCloseButton}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
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

                  {typeof selectedRequest.rating === 'number' && (
                    <View style={styles.detailRow}>
                      <FontAwesome name="star" size={20} color="#6B7280" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.detailLabel}>User Rating</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          {[1,2,3,4,5].map((star) => (
                            <FontAwesome
                              key={star}
                              name={(selectedRequest.rating ?? 0) >= star ? 'star' : 'star-o'}
                              size={20}
                              color={(selectedRequest.rating ?? 0) >= star ? '#FFC107' : '#D1D5DB'}
                              style={{ marginRight: 4 }}
                            />
                          ))}
                          <Text style={[styles.detailValue, { marginLeft: 8 }]}>
                            {selectedRequest.rating?.toFixed(1)} / 5
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

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

                {/* Action Buttons */}
                <View style={styles.actionSection}>
                  <Text style={styles.actionSectionTitle}>Quick Actions</Text>
                  
                  {selectedRequest.status === 'Requested' && (
                    <TouchableOpacity
                      style={styles.primaryActionButton}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'In Progress');
                        setIsDetailOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play-circle" size={20} color="#fff" />
                      <Text style={styles.primaryActionButtonText}>Start Processing</Text>
                    </TouchableOpacity>
                  )}

                  {selectedRequest.status === 'In Progress' && (
                    <TouchableOpacity
                      style={[styles.primaryActionButton, { backgroundColor: '#10B981' }]}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'Delivered');
                        setIsDetailOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.primaryActionButtonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                  )}

                  {selectedRequest.status === 'Delivered' && (
                    <View style={styles.completedBanner}>
                      <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
                      <Text style={styles.completedBannerText}>Request Completed</Text>
                    </View>
                  )}

                  {selectedRequest.status !== 'Cancelled' && selectedRequest.status !== 'Delivered' && (
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'Cancelled');
                        setIsDetailOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                      <Text style={styles.secondaryActionButtonText}>Cancel Request</Text>
                    </TouchableOpacity>
                  )}

                  {selectedRequest.status === 'Cancelled' && (
                    <TouchableOpacity
                      style={[styles.primaryActionButton, { backgroundColor: '#DC2626' }]}
                      onPress={() => deleteRequest(selectedRequest.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="delete" size={20} color="#fff" />
                      <Text style={styles.primaryActionButtonText}>Delete Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    paddingBottom: 16,
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
  ngoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    paddingRight: 20,
  },
  statCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statCardActive: {
    backgroundColor: '#fff',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 4,
  },
  statNumberActive: {
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statLabelActive: {
    color: '#1E40AF',
    fontWeight: '700',
  },
  listSection: {
    flex: 1,
    paddingTop: 16,
  },
  listHeader: {
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
  actionButtonProgress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
  },
  actionButtonDeliver: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
  },
  actionButtonDelivered: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
  },
  actionButtonCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 6,
  },
  actionButtonDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionButtonTextDelivered: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionButtonTextCancel: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
  modalContent: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  mapContainer: {
    marginBottom: 16,
  },
  modernMap: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
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
  actionSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  secondaryActionButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  completedBannerText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
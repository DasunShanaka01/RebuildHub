import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Picker } from '@react-native-picker/picker';
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
}

export default function NgoAidScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<AidRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [unsubscribeRequests, setUnsubscribeRequests] = useState<(() => void) | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
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
      case 'Low': return '#4CAF50';
      case 'Medium': return '#FF9800';
      case 'High': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Requested': return '#2196F3';
      case 'In Progress': return '#FF9800';
      case 'Delivered': return '#2E7D32';
      case 'Cancelled': return '#F44336';
      default: return '#666';
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
    const getActionButton = () => {
      switch (item.status) {
        case 'Requested':
          return (
            <TouchableOpacity
              style={[styles.actionButton, styles.inProgressButton]}
              onPress={() => updateRequestStatus(item.id, 'In Progress')}
            >
              <Text style={styles.actionButtonText}>In Progress</Text>
            </TouchableOpacity>
          );
        case 'In Progress':
          return (
            <TouchableOpacity
              style={[styles.actionButton, styles.deliveredButton]}
              onPress={() => updateRequestStatus(item.id, 'Delivered')}
            >
              <Text style={styles.actionButtonText}>Delivered</Text>
            </TouchableOpacity>
          );
        case 'Delivered':
          return (
            <View style={[styles.actionButton, styles.deliveredButton]}>
              <Text style={styles.actionButtonText}>✓ Delivered</Text>
            </View>
          );
        default:
          return null;
      }
    };

    const getCancelButton = () => {
      if (item.status === 'Cancelled') {
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteRequest(item.id)}
          >
            <Text style={styles.actionButtonText}>Delete Request</Text>
          </TouchableOpacity>
        );
      } else if (item.status !== 'Delivered') {
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => updateRequestStatus(item.id, 'Cancelled')}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        );
      }
      return null;
    };

    return (
      <TouchableOpacity style={styles.card} onPress={() => onPressView(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.fullName}</Text>
          <View style={styles.cardActions}>
            {getActionButton()}
            {getCancelButton()}
          </View>
        </View>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: getUrgencyColor(item.urgencyLevel) }]}>
            <Text style={styles.badgeText}>{item.urgencyLevel}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>NIC: {item.nicNumber} • Contact: {item.contactNumber} • GPS: {item.gpsLocation || 'N/A'}</Text>
        <Text style={styles.cardMeta}>Needs: {['food','water','medicine','shelter']
          .filter((k) => (item.aidTypes as any)[k])
          .join(', ') || 'None'} {item.aidTypes.other ? `, Other: ${item.aidTypes.other}` : ''}</Text>
        {item.createdAt && (
          <Text style={styles.cardMeta}>
            Requested: {new Date((item.createdAt.seconds ?? 0) * 1000).toLocaleString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aid Management</Text>
      <Text style={styles.subtitle}>Manage all aid requests from users</Text>
      

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={[styles.statItem, statusFilter === 'All' && styles.statItemActive]}
          onPress={() => setStatusFilter('All')}
        >
          <Text style={[styles.statNumber, statusFilter === 'All' && styles.statNumberActive]}>
            {requests.length}
          </Text>
          <Text style={[styles.statLabel, statusFilter === 'All' && styles.statLabelActive]}>
            All Requests
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.statItem, statusFilter === 'Requested' && styles.statItemActive]}
          onPress={() => setStatusFilter('Requested')}
        >
          <Text style={[styles.statNumber, statusFilter === 'Requested' && styles.statNumberActive]}>
            {requests.filter(r => r.status === 'Requested').length}
          </Text>
          <Text style={[styles.statLabel, statusFilter === 'Requested' && styles.statLabelActive]}>
            New Requests
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.statItem, statusFilter === 'In Progress' && styles.statItemActive]}
          onPress={() => setStatusFilter('In Progress')}
        >
          <Text style={[styles.statNumber, statusFilter === 'In Progress' && styles.statNumberActive]}>
            {requests.filter(r => r.status === 'In Progress').length}
          </Text>
          <Text style={[styles.statLabel, statusFilter === 'In Progress' && styles.statLabelActive]}>
            In Progress
          </Text>
        </TouchableOpacity>
        
        
        <TouchableOpacity 
          style={[styles.statItem, statusFilter === 'Delivered' && styles.statItemActive]}
          onPress={() => setStatusFilter('Delivered')}
        >
          <Text style={[styles.statNumber, statusFilter === 'Delivered' && styles.statNumberActive]}>
            {requests.filter(r => r.status === 'Delivered').length}
          </Text>
          <Text style={[styles.statLabel, statusFilter === 'Delivered' && styles.statLabelActive]}>
            Delivered
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.sectionTitle}>
          {statusFilter === 'All' ? 'All Requests' : `${statusFilter} Requests`} ({filteredRequests.length})
        </Text>
      </View>
      
      {isLoadingRequests ? (
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {statusFilter === 'All' ? 'No aid requests found.' : `No ${statusFilter.toLowerCase()} requests found.`}
            </Text>
          }
          contentContainerStyle={filteredRequests.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={isDetailOpen}
        animationType="slide"
        onRequestClose={() => setIsDetailOpen(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Details</Text>
            <TouchableOpacity onPress={() => setIsDetailOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {selectedRequest && (
            <View style={styles.detailContainer}>
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
                <Text style={styles.detailLabel}>GPS Location</Text>
                <Text style={styles.detailValue}>{selectedRequest.gpsLocation || 'N/A'}</Text>
              </View>
              
              {/* Map Display */}
              {(() => {
                const gps = selectedRequest.gpsLocation;
                const parts = gps ? gps.split(',').map((p) => p.trim()) : [];
                const lat = parts.length === 2 ? Number(parts[0]) : NaN;
                const lng = parts.length === 2 ? Number(parts[1]) : NaN;
                const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
                if (!valid) return null;
                return (
                  <View style={styles.mapContainer}>
                    <Text style={styles.detailLabel}>Location Map</Text>
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
                <Text style={styles.detailLabel}>Urgency Level</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.detailUrgencyDot, { backgroundColor: getUrgencyColor(selectedRequest.urgencyLevel) }]} />
                  <Text style={[styles.detailValue, { marginLeft: 8 }]}>{selectedRequest.urgencyLevel}</Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Status</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.detailStatusDot, { backgroundColor: getStatusColor(selectedRequest.status) }]} />
                  <Text style={[styles.detailValue, { marginLeft: 8 }]}>{selectedRequest.status}</Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Aid Types Needed</Text>
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
              
              {/* Status Update Section */}
              <View style={styles.statusUpdateSection}>
                <Text style={styles.detailLabel}>Update Status</Text>
                <View style={styles.statusButtonsContainer}>
                  {selectedRequest.status === 'Requested' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.inProgressButton]}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'In Progress');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Text style={styles.statusButtonText}>Mark In Progress</Text>
                    </TouchableOpacity>
                  )}
                  {selectedRequest.status === 'In Progress' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.deliveredButton]}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'Delivered');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Text style={styles.statusButtonText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  )}
                  {selectedRequest.status === 'Delivered' && (
                    <View style={[styles.statusButton, styles.deliveredButton]}>
                      <Text style={styles.statusButtonText}>✓ Delivered</Text>
                    </View>
                  )}
                  {selectedRequest.status !== 'Cancelled' && selectedRequest.status !== 'Delivered' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.cancelButton]}
                      onPress={() => {
                        updateRequestStatus(selectedRequest.id, 'Cancelled');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Text style={styles.statusButtonText}>Cancel Request</Text>
                    </TouchableOpacity>
                  )}
                  {selectedRequest.status === 'Cancelled' && (
                    <TouchableOpacity
                      style={[styles.statusButton, styles.deleteButton]}
                      onPress={() => {
                        deleteRequest(selectedRequest.id);
                        setIsDetailOpen(false);
                      }}
                    >
                      <Text style={styles.statusButtonText}>Delete Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  statItemActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statNumberActive: {
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statLabelActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  listHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    flex: 1,
    marginHorizontal: -20,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  card: {
    backgroundColor: '#fff',
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
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  detailContainer: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  detailUrgencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  detailStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mapContainer: {
    marginBottom: 16,
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  statusUpdateSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inProgressButton: {
    backgroundColor: '#FF9800',
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  deliveredButton: {
    backgroundColor: '#2E7D32',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  deleteButton: {
    backgroundColor: '#D32F2F',
  },
  picker: {
    height: 44,
  },
});
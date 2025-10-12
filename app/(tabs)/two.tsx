import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ScrollView, 
  ActivityIndicator,
  Animated,
  Alert 
} from 'react-native';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where 
} from 'firebase/firestore';
import { db, auth } from '../../FirebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface Emergency {
  id: string;
  type: string;
  userId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt?: any;
  updatedAt?: any;
  status: 'pending' | 'Approved' | 'In Progress' | 'Done';
  description?: string;
}

export default function DashboardScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [myEmergencies, setMyEmergencies] = useState<Emergency[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
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
      if (unsubscribe) {
        unsubscribe();
      }
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMyEmergencies([]);
      if (unsubscribe) {
        unsubscribe();
        setUnsubscribe(null);
      }
      return;
    }
    if (unsubscribe) {
      unsubscribe();
      setUnsubscribe(null);
    }
    const unsub = subscribeToMyEmergencies();
    if (unsub) setUnsubscribe(() => unsub);
  }, [currentUser?.uid]);

  const subscribeToMyEmergencies = () => {
    if (!currentUser) return;
    setIsLoading(true);
    const q = query(
      collection(db, 'emergencies'),
      where('userId', '==', currentUser.uid)
      // TODO: Add back orderBy('createdAt', 'desc') after creating Firestore index
    );
    return onSnapshot(q, (snapshot) => {
      const list: Emergency[] = snapshot.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as Omit<Emergency, 'id'>) 
      }));
      setMyEmergencies(list);
      setIsLoading(false);
    }, (err) => {
      console.error('subscribeToMyEmergencies error', err);
      setIsLoading(false);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#3B82F6';
      case 'Approved': return '#8B5CF6';
      case 'In Progress': return '#F59E0B';
      case 'Done': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'Approved': return 'checkmark-outline';
      case 'In Progress': return 'hourglass-outline';
      case 'Done': return 'checkmark-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const updateEmergencyStatus = async (emergencyId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'emergencies', emergencyId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', `Status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating emergency status:', error);
    }
  };

  const handleArrived = (emergencyId: string) => {
    Alert.alert(
      'Confirm Arrival',
      'Are you sure you have arrived and the emergency is resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Arrived', 
          onPress: () => updateEmergencyStatus(emergencyId, 'Done') 
        }
      ]
    );
  };

  const filteredEmergencies = statusFilter === 'All' 
    ? myEmergencies 
    : myEmergencies.filter(emergency => emergency.status === statusFilter);

  const renderEmergencyCard = ({ item }: { item: Emergency }) => (
    <View style={styles.modernCard}>
      <View style={styles.cardTopSection}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarCircle}>
            <Ionicons name="medical" size={24} color="#fff" />
          </View>
          <View style={styles.cardTitleSection}>
            <Text style={styles.modernCardTitle}>
              {item.type || 'Emergency Request'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {item.createdAt?.toDate?.().toLocaleDateString()} at {item.createdAt?.toDate?.().toLocaleTimeString()}
            </Text>
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
        {item.location?.latitude && item.location?.longitude && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={1}>
              Location: {item.location.latitude}, {item.location.longitude}
            </Text>
          </View>
        )}

        {item.description && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        {item.status === 'Approved' && (
          <View style={styles.actionButtonApproved}>
            <Ionicons name="checkmark-done" size={16} color="#10B981" />
            <Text style={styles.actionButtonTextApproved}>Approved</Text>
          </View>
        )}
        
        {item.status === 'In Progress' && (
          <>
            <View style={styles.actionButtonInProgress}>
              <Ionicons name="hourglass" size={16} color="#F59E0B" />
              <Text style={styles.actionButtonTextInProgress}>In Progress</Text>
            </View>
            <TouchableOpacity 
              onPress={() => handleArrived(item.id)}
              style={styles.actionButtonArrived}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Arrived</Text>
            </TouchableOpacity>
          </>
        )}

        {item.status === 'Done' && (
          <View style={styles.actionButtonDone}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.actionButtonTextDone}>Completed</Text>
          </View>
        )}

        {item.status === 'pending' && (
          <View style={styles.actionButtonPending}>
            <Ionicons name="time" size={16} color="#3B82F6" />
            <Text style={styles.actionButtonTextPending}>Waiting for Approval</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>My Dashboard</Text>
            <Text style={styles.headerSubtitle}>Track your emergency requests</Text>
          </View>
          <View style={styles.dashboardIcon}>
            <Text style={{ fontSize: 25 }}>📊</Text>
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
              {myEmergencies.length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'All' && styles.statLabelActive]}>
              Total
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'pending' && styles.statCardActive]}
            onPress={() => setStatusFilter('pending')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="time" size={24} color="#3B82F6" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'pending' && styles.statNumberActive]}>
              {myEmergencies.filter(r => r.status === 'pending').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'pending' && styles.statLabelActive]}>
              Pending
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'In Progress' && styles.statCardActive]}
            onPress={() => setStatusFilter('In Progress')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="hourglass" size={24} color="#F59E0B" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'In Progress' && styles.statNumberActive]}>
              {myEmergencies.filter(r => r.status === 'In Progress').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'In Progress' && styles.statLabelActive]}>
              In Progress
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.statCard, statusFilter === 'Done' && styles.statCardActive]}
            onPress={() => setStatusFilter('Done')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
            <Text style={[styles.statNumber, statusFilter === 'Done' && styles.statNumberActive]}>
              {myEmergencies.filter(r => r.status === 'Done').length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'Done' && styles.statLabelActive]}>
              Done
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              {statusFilter === 'All' ? 'All My Requests' : `${statusFilter} Requests`}
            </Text>
            <Text style={styles.listSubtitle}>{filteredEmergencies.length} total</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading your requests...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredEmergencies}
            keyExtractor={(item) => item.id}
            renderItem={renderEmergencyCard}
            style={styles.list}
            contentContainerStyle={filteredEmergencies.length === 0 ? styles.emptyListContainer : styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons 
                  name="medical-outline" 
                  size={64} 
                  color="#D1D5DB" 
                />
                <Text style={styles.emptyStateTitle}>
                  {statusFilter === 'All' ? 'No Emergency Requests Yet' : `No ${statusFilter} Requests`}
                </Text>
                <Text style={styles.emptyStateText}>
                  {statusFilter === 'All' 
                    ? 'You haven\'t made any emergency requests yet. When you do, they\'ll appear here.' 
                    : `You don't have any emergency requests with ${statusFilter} status.`}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  dashboardIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#EFF6FF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  statsScroll: {
    flexGrow: 0,
  },
  statsContainer: {
    paddingVertical: 10,
  },
  statCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
    transform: [{ scale: 1.02 }],
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statNumberActive: {
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statLabelActive: {
    color: '#E5E7EB',
  },
  listSection: {
    flex: 1,
    paddingTop: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  listSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitleSection: {
    flex: 1,
  },
  modernCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusRow: {
    alignItems: 'flex-start',
  },
  modernBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modernBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardContent: {
    padding: 16,
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButtonApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  actionButtonTextApproved: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  actionButtonInProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  actionButtonTextInProgress: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  actionButtonArrived: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonDone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  actionButtonTextDone: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  actionButtonPending: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  actionButtonTextPending: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});

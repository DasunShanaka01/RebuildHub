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
import { useRouter } from 'expo-router';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { db, auth } from '../../FirebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface UserInfo {
  uid: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt?: any;
}

interface Emergency {
  id: string;
  type: string;
  userId?: string; // The UID of the user who created the emergency
  location?: {
    latitude: number;
    longitude: number;
  };
  user?: UserInfo; // Full user information fetched from users collection
  createdAt?: any;
  updatedAt?: any;
  status: 'pending' | 'Approved' | 'In Progress' | 'Done';
  description?: string;
}

export default function NotificationPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [isLoadingEmergencies, setIsLoadingEmergencies] = useState<boolean>(false);
  const [unsubscribeEmergencies, setUnsubscribeEmergencies] = useState<(() => void) | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

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
      if (unsubscribeEmergencies) {
        unsubscribeEmergencies();
      }
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setEmergencies([]);
      if (unsubscribeEmergencies) {
        unsubscribeEmergencies();
        setUnsubscribeEmergencies(null);
      }
      return;
    }
    if (unsubscribeEmergencies) {
      unsubscribeEmergencies();
      setUnsubscribeEmergencies(null);
    }
    const unsub = subscribeToAllEmergencies();
    if (unsub) setUnsubscribeEmergencies(() => unsub);
  }, [currentUser?.uid]);

  const fetchUserInfo = async (userId: string): Promise<UserInfo | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data() as UserInfo;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  };

  const subscribeToAllEmergencies = () => {
    if (!currentUser) return;
    setIsLoadingEmergencies(true);
    const q = query(
      collection(db, 'emergencies'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, async (snapshot) => {
      try {
        const emergencyPromises = snapshot.docs.map(async (d) => {
          const emergencyData = d.data() as Omit<Emergency, 'id'>;
          
          // Fetch user information if userId exists
          let userInfo: UserInfo | null = null;
          if (emergencyData.userId) {
            userInfo = await fetchUserInfo(emergencyData.userId);
          }
          
          return {
            id: d.id,
            ...emergencyData,
            user: userInfo
          } as Emergency;
        });

        const list = await Promise.all(emergencyPromises);
        setEmergencies(list);
        setIsLoadingEmergencies(false);
      } catch (error) {
        console.error('Error processing emergencies:', error);
        setIsLoadingEmergencies(false);
      }
    }, (err) => {
      console.error('subscribeToAllEmergencies error', err);
      setIsLoadingEmergencies(false);
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
      Alert.alert('Success', `Emergency status updated to ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update emergency status');
      console.error('Error updating emergency status:', error);
    }
  };

  const handleViewQR = (emergencyId: string) => {
    router.push({
      pathname: '/Emergency/QRCodeScreen',
      params: { emergencyId }
    });
  };

  const handleApprove = (emergencyId: string) => {
    updateEmergencyStatus(emergencyId, 'In Progress');
  };

  const filteredEmergencies = statusFilter === 'All' 
    ? emergencies 
    : emergencies.filter(emergency => emergency.status === statusFilter);

  const renderEmergencyCard = ({ item }: { item: Emergency }) => (
    <TouchableOpacity style={styles.modernCard} activeOpacity={0.7}>
      <View style={styles.cardTopSection}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.cardTitleSection}>
            <Text style={styles.modernCardTitle}>
              {item.user?.name || 'Anonymous User'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Phone: {item.user?.phone || 'Not provided'}
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
        <View style={styles.infoRow}>
          <Ionicons name="alert-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>Type: {item.type || 'Not specified'}</Text>
        </View>
        
        {item.location?.latitude && item.location?.longitude && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={1}>
              Location: {item.location.latitude}, {item.location.longitude}
            </Text>
          </View>
        )}

        {item.createdAt && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.createdAt?.toDate?.().toLocaleDateString()} at {item.createdAt?.toDate?.().toLocaleTimeString()}
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
        {item.status === 'pending' && (
          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              handleApprove(item.id);
            }} 
            style={styles.actionButtonApprove}
          >
            <Ionicons name="checkmark-circle" size={16} color="#ffffffff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
        )}
        {item.status === 'In Progress' && (
          <View style={styles.actionButtonApproved}>
            <Ionicons name="checkmark-done" size={16} color="#10B981" />
            <Text style={styles.actionButtonTextApproved}>Approved</Text>
          </View>
        )}

        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            handleViewQR(item.id);
          }} 
          style={styles.actionButtonViewQR}
        >
          <Ionicons name="qr-code-outline" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>View QR</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Emergency Management</Text>
            <Text style={styles.headerSubtitle}>Monitor and respond to emergencies</Text>
          </View>
          <View style={styles.emergencyIcon}>
            <Text style={{ fontSize: 25 }}>🚨</Text>
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
              {emergencies.length}
            </Text>
            <Text style={[styles.statLabel, statusFilter === 'All' && styles.statLabelActive]}>
              All Requests
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
              {emergencies.filter(r => r.status === 'pending').length}
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
              {emergencies.filter(r => r.status === 'In Progress').length}
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
              {emergencies.filter(r => r.status === 'Done').length}
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
              {statusFilter === 'All' ? 'All Emergencies' : `${statusFilter} Emergencies`}
            </Text>
            <Text style={styles.listSubtitle}>{filteredEmergencies.length} total</Text>
          </View>
        </View>

        {isLoadingEmergencies ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC2626" />
            <Text style={styles.loadingText}>Loading emergencies...</Text>
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
                  name={statusFilter === 'All' ? "person-outline" : "people-outline"} 
                  size={64} 
                  color="#D1D5DB" 
                />
                <Text style={styles.emptyStateTitle}>
                  {statusFilter === 'All' ? 'No Emergencies Yet' : `No ${statusFilter} Emergencies`}
                </Text>
                <Text style={styles.emptyStateText}>
                  {statusFilter === 'All' 
                    ? 'When emergency alerts are reported, they will appear here for your review and action.' 
                    : `There are currently no emergencies with ${statusFilter} status.`}
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
  emergencyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
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
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
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
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statLabelActive: {
    color: '#B91C1C',
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
    backgroundColor: '#DC2626',
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
  cardActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButtonApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
  },
  actionButtonViewQR: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 6,
  },
  actionButtonApproved: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionButtonTextApproved: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import BackButton from '../../components/BackButton';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'high': return '#DC2626';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#64748B';
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'approved': return '#10B981';
    case 'rejected': return '#DC2626';
    case 'in-progress': return '#2563EB';
    case 'pending': return '#F59E0B';
    default: return '#64748B';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'earthquakes': return '🏚️';
    case 'tsunamis': return '🌊';
    case 'landslides': return '⛰️';
    case 'floods': return '💧';
    case 'droughts': return '🌵';
    case 'wildfires': return '🔥';
    default: return '⚠️';
  }
};

export default function NGOReportView() {
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reportData"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReports(data);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "reportData", id), { reportStatus: status });
  };

  const filteredReports = filter === 'all' 
    ? reports 
    : reports.filter(report => report.reportStatus === filter);

  const getStatusCounts = () => {
    return {
      all: reports.length,
      pending: reports.filter(r => r.reportStatus === 'pending').length,
      approved: reports.filter(r => r.reportStatus === 'approved').length,
    };
  };

  const counts = getStatusCounts();

  const SmallMap = ({ location, address }: { location: any; address?: string }) => {
    if (!location || !location.latitude || !location.longitude) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.noLocationContainer}>
            <Text style={styles.noLocationIcon}>📍</Text>
            <Text style={styles.noLocationText}>No Location Data</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingIndicatorColor="#2563EB"
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Report Location"
            description={address || "Damage Report Location"}
          />
        </MapView>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.reportCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.categoryIcon}>{getCategoryIcon(item.category)}</Text>
          <View style={styles.headerText}>
            <Text style={styles.categoryText}>{item.category}</Text>
            <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
              <Text style={styles.severityText}>{item.severity}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.reportStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.reportStatus) }]}>
            {item.reportStatus?.toUpperCase() || 'PENDING'}
          </Text>
        </View>
      </View>

      <View style={styles.descriptionSection}>
        <Text style={styles.descriptionLabel}>Description</Text>
        <Text style={styles.descriptionText} numberOfLines={3}>{item.description}</Text>
      </View>

      <View style={styles.locationSection}>
        <Text style={styles.locationLabel}>Location</Text>
        {item.location ? (
          <>
            <Text style={styles.coordinates}>
              {item.location.latitude?.toFixed(4)}, {item.location.longitude?.toFixed(4)}
            </Text>
            {item.address && (
              <Text style={styles.address}>{item.address}</Text>
            )}
            <SmallMap location={item.location} address={item.address} />
            <Text style={styles.timestamp}>
              Reported: {item.timestamp?.toDate ? 
                item.timestamp.toDate().toLocaleDateString() + ' at ' + item.timestamp.toDate().toLocaleTimeString() : 
                new Date(item.timestamp).toLocaleDateString() + ' at ' + new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </>
        ) : (
          <Text style={styles.noLocationText}>No location data available</Text>
        )}
      </View>

      <View style={styles.actionButtons}>

        {item.reportStatus?.toLowerCase() !== 'approved' && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.approveButton]} 
          onPress={() => updateStatus(item.id, "approved")}
        >
          <Text style={styles.actionButtonText}>✓ Approve</Text>
        </TouchableOpacity>
      )}
      
        {/* <TouchableOpacity 
          style={[styles.actionButton, styles.progressButton]} 
          onPress={() => updateStatus(item.id, "in-progress")}
        >
          <Text style={styles.actionButtonText}>⟳ In Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]} 
          onPress={() => updateStatus(item.id, "rejected")}
        >
          <Text style={styles.actionButtonText}>✕ Reject</Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <BackButton />
      
      <View style={styles.header}>
        <Text style={styles.title}>NGO Dashboard</Text>
        <Text style={styles.subtitle}>Manage disaster reports</Text>
      </View>

      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({counts.all})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending ({counts.pending})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filter === 'approved' && styles.filterButtonActive]}
          onPress={() => setFilter('approved')}
        >
          <Text style={[styles.filterText, filter === 'approved' && styles.filterTextActive]}>
            Approved ({counts.approved})
          </Text>
        </TouchableOpacity>
      </View>

      {filteredReports.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Reports</Text>
          <Text style={styles.emptyText}>
            {filter === 'all' 
              ? 'No disaster reports submitted yet' 
              : `No ${filter} reports found`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  categoryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  descriptionSection: {
    marginBottom: 14,
  },
  descriptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  locationSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  coordinates: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  mapContainer: {
    height: 140,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  map: {
    flex: 1,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  noLocationIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: "#10B981",
  },
  progressButton: {
    backgroundColor: "#2563EB",
  },
  rejectButton: {
    backgroundColor: "#DC2626",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
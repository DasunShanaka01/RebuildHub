import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import BackButton from '../../components/BackButton';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function NGOReportView() {
  const [reports, setReports] = useState<any[]>([]);

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

  // Small Map Component for each report
  const SmallMap = ({ location, address }: { location: any; address?: string }) => {
    if (!location || !location.latitude || !location.longitude) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.noLocationContainer}>
            <Text style={styles.noLocationText}>📍 No Location Data</Text>
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
          loadingIndicatorColor="#4DB6AC"
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
    <View style={styles.card}>
      <Text style={styles.title}>{item.category} - {item.severity}</Text>
      <Text style={styles.description}>Description: {item.description}</Text>
      <Text style={styles.status}>Status: {item.reportStatus}</Text>
      
      {/* Location Information */}
      <View style={styles.locationSection}>
        <Text style={styles.locationTitle}>📍 Location Information</Text>
        {item.location ? (
          <View style={styles.locationInfo}>
            <Text style={styles.coordinates}>
              Lat: {item.location.latitude?.toFixed(4) || 'N/A'}, 
              Lon: {item.location.longitude?.toFixed(4) || 'N/A'}
            </Text>
            {item.address && (
              <Text style={styles.address}>Address: {item.address}</Text>
            )}
            <Text style={styles.timestamp}>
              Reported: {item.timestamp?.toDate ? 
                item.timestamp.toDate().toLocaleString() : 
                new Date(item.timestamp).toLocaleString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.noLocationText}>No location data available</Text>
        )}
        
        {/* Small Map View */}
        <SmallMap location={item.location} address={item.address} />
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#4CAF50" }]} onPress={() => updateStatus(item.id, "approved")}>
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#F44336" }]} onPress={() => updateStatus(item.id, "rejected")}>
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#2196F3" }]} onPress={() => updateStatus(item.id, "in-progress")}>
          <Text style={styles.btnText}>In Progress</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#f9f9f9" }}>
        <BackButton />
      <Text style={styles.header}>NGO Dashboard</Text>
        
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#1A237E",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1A237E",
  },
  description: {
    fontSize: 14,
    marginBottom: 6,
    color: "#333",
    lineHeight: 20,
  },
  status: {
    fontSize: 14,
    marginBottom: 12,
    color: "#666",
    fontWeight: "500",
  },
  locationSection: {
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F2F1",
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A237E",
    marginBottom: 8,
  },
  locationInfo: {
    marginBottom: 12,
  },
  coordinates: {
    fontSize: 14,
    color: "#4DB6AC",
    fontWeight: "500",
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    fontStyle: "italic",
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  mapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#4DB6AC",
    backgroundColor: "#E8F4FD",
  },
  map: {
    flex: 1,
  },
  noLocationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  noLocationText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    marginTop: 12,
    justifyContent: "space-around",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
});

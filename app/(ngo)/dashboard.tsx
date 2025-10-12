import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../FirebaseConfig";

interface Report {
  id: string;
  location: { latitude: number; longitude: number };
  severity: "low" | "medium" | "high";
}

interface Emergency {
  id: string;
  type: string;
  location: { latitude: number; longitude: number };
}

export default function NgoDashboardScreen() {
  const router = useRouter();
  const [locationPermission, setLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);

  // Navigate to notifications
  const handleNotificationPress = () => {
    router.push("/Emergency/notification");
  };

  // Request user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  // Fetch reports
  useEffect(() => {
    const q = query(collection(db, "reportData"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Report[] = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          if (!d?.location) return null;

          let lat, lng;
          if (typeof d.location.latitude === "number" && typeof d.location.longitude === "number") {
            lat = d.location.latitude;
            lng = d.location.longitude;
          } else if (d.location._latitude && d.location._longitude) {
            lat = d.location._latitude;
            lng = d.location._longitude;
          }
          if (typeof lat !== "number" || typeof lng !== "number") return null;

          return {
            id: doc.id,
            location: { latitude: lat, longitude: lng },
            severity: (d.severity || "medium") as Report["severity"],
          };
        })
        .filter(Boolean) as Report[];

      setReports(data);
    });
    return unsubscribe;
  }, []);

  // Fetch emergencies
  useEffect(() => {
    const q = query(collection(db, "emergencies"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Emergency[] = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          if (!d?.location) return null;

          let lat, lng;
          if (typeof d.location.latitude === "number" && typeof d.location.longitude === "number") {
            lat = d.location.latitude;
            lng = d.location.longitude;
          } else if (d.location._latitude && d.location._longitude) {
            lat = d.location._latitude;
            lng = d.location._longitude;
          }
          if (typeof lat !== "number" || typeof lng !== "number") return null;

          return {
            id: doc.id,
            type: d.type || "Unknown",
            location: { latitude: lat, longitude: lng },
          };
        })
        .filter(Boolean) as Emergency[];

      setEmergencies(data);
    });
    return unsubscribe;
  }, []);

  const getSeverityColors = (severity: Report["severity"]) => {
    switch (severity) {
      case "high":
        return { main: "#E53935", dark: "#B71C1C" };
      case "medium":
        return { main: "#FB8C00", dark: "#E65100" };
      default:
        return { main: "#43A047", dark: "#1B5E20" };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Title */}
        <Text style={styles.dashboardTitle}>NGO Dashboard</Text>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardIcon}>📄</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Reports</Text>
                <Text style={styles.cardNumber}>{reports.length}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardIcon}>🚨</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Emergencies</Text>
                <Text style={styles.cardNumber}>{emergencies.length}</Text>
              </View>
            </View>
          </View>
        </View>



        {/* Emergency Notifications Button */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={handleNotificationPress}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Emergency Notifications</Text>
        </TouchableOpacity>


        {/* Map Section */}
        {locationPermission && userLocation ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
          >
            {/* Report Markers */}
            {reports.map((report) => {
              const colors = getSeverityColors(report.severity);
              return (
                <React.Fragment key={report.id}>
                  <Marker coordinate={report.location}>
                    <View style={[styles.reportMarker, { backgroundColor: colors.main, borderColor: colors.dark }]}>
                      <Text style={styles.markerText}>
                        {report.severity === "high" ? "H" : report.severity === "medium" ? "M" : "L"}
                      </Text>
                    </View>
                  </Marker>
                  <Circle
                    center={report.location}
                    radius={report.severity === "high" ? 1500 : report.severity === "medium" ? 1000 : 500}
                    fillColor={report.severity === "high" ? "rgba(255,0,0,0.3)" : report.severity === "medium" ? "rgba(255,165,0,0.3)" : "rgba(0,128,0,0.3)"}
                    strokeColor={colors.dark}
                    strokeWidth={2}
                  />
                </React.Fragment>
              );
            })}

            {/* Emergency Markers */}
            {emergencies.map((em) => (
              <React.Fragment key={`em-${em.id}`}>
                <Marker coordinate={em.location}>
                  <View style={styles.emergencyMarker}>
                    <Text style={styles.emergencyIcon}>🚨</Text>
                  </View>
                  <Callout tooltip>
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>Emergency</Text>
                      <Text style={styles.calloutSub}>{em.type}</Text>
                    </View>
                  </Callout>
                </Marker>
                <Circle
                  center={em.location}
                  radius={800}
                  fillColor="rgba(75, 0, 130, 0.25)"
                  strokeColor="#4B0082"
                  strokeWidth={2}
                />
              </React.Fragment>
            ))}
          </MapView>
        ) : (
          <Text style={styles.permissionText}>Requesting location permission...</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f7f8fa" },
  dashboardTitle: { fontSize: 26, fontWeight: "bold", marginBottom: 16, color: "#111" },
  statsContainer: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 20,
  paddingHorizontal: 2,
},
card: {
  flex: 1,
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 16,
  marginHorizontal: 5,
  alignItems: "center",
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 5,
  elevation: 3,
},
cardContent: {
  flexDirection: "row",
  alignItems: "center",
},
cardIcon: {
  fontSize: 20, // smaller
  marginRight: 12, // spacing between icon and text
},
cardText: {
  flex: 1,
},
cardTitle: {
  fontSize: 16,
  fontWeight: "600",
},
cardNumber: {
  fontSize: 20,
  fontWeight: "700",
  color: "#DC2626",
},


  notificationButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  map: { flex: 1, borderRadius: 12, minHeight: 400 },
  permissionText: { textAlign: "center", color: "#777", marginTop: 20 },

  // Report Marker
  reportMarker: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  markerText: { color: "#fff", fontWeight: "bold" },

  // Emergency Marker
  emergencyMarker: { width: 40, height: 40, backgroundColor: "#4B0082", borderRadius: 20, borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center" },
  emergencyIcon: { fontSize: 18, color: "#fff" },

  // Callout
  calloutBox: { backgroundColor: "#fff", borderRadius: 10, padding: 8, borderWidth: 1, borderColor: "#4B0082" },
  calloutTitle: { fontWeight: "bold", color: "#4B0082", marginBottom: 2 },
  calloutSub: { color: "#333" },
});

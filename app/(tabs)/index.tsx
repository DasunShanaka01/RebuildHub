import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Link, Redirect } from "expo-router";
import MapView, { PROVIDER_GOOGLE, Marker, Circle } from "react-native-maps";
import * as Location from "expo-location";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig"; // adjust path

interface Report {
  id: string;
  location: { latitude: number; longitude: number };
  severity: "low" | "medium" | "high";
}

export default function Index() {
  const [locationPermission, setLocationPermission] = useState(false);
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isSafe, setIsSafe] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "reports"));
        const reportsData: Report[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          location: doc.data().location,
          severity: doc.data().severity,
        }));
        setReports(reportsData);
      } catch (error) {
        console.error("Error fetching reports:", error);
      }
    };
    fetchReports();
  }, []);

  useEffect(() => {
    if (!userLocation || reports.length === 0) return;

    const inDanger = reports.some((report) => {
      const radius =
        report.severity === "high" ? 1500 : report.severity === "medium" ? 1000 : 500;

      const distance = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        report.location.latitude,
        report.location.longitude
      );

      return distance <= radius;
    });

    setIsSafe(!inDanger);
  }, [userLocation, reports]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to RebuildHub</Text>
        <Text style={[styles.subtitle, isSafe ? styles.safeText : styles.dangerText]}>
          You are currently: {isSafe ? "Safe ✅" : "In Danger ⚠️"}
        </Text>
      </View>

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
          minZoomLevel={2}
          maxZoomLevel={20}
        >
          {reports.map((report) => (
            <React.Fragment key={report.id}>
              <Marker
                coordinate={report.location}
                title={`Report (${report.severity})`}
              />
              <Circle
                center={report.location}
                radius={
                  report.severity === "high"
                    ? 1500
                    : report.severity === "medium"
                    ? 1000
                    : 500
                }
                fillColor={
                  report.severity === "high"
                    ? "rgba(255,0,0,0.3)"
                    : report.severity === "medium"
                    ? "rgba(255,165,0,0.3)"
                    : "rgba(0,128,0,0.3)"
                }
                strokeColor={
                  report.severity === "high"
                    ? "red"
                    : report.severity === "medium"
                    ? "orange"
                    : "green"
                }
                strokeWidth={2}
              />
            </React.Fragment>
          ))}
        </MapView>
      ) : (
        <Text style={styles.permissionText}>Requesting location permission...</Text>
      )}

      <Link
        href={{ pathname: "/reportSubmit/[id]", params: { id: "1" } }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Go to Report</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f5",
    padding: 16,
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#222",
  },
  subtitle: {
    fontSize: 18,
    marginTop: 8,
  },
  safeText: {
    color: "green",
    fontWeight: "600",
  },
  dangerText: {
    color: "red",
    fontWeight: "700",
  },
  map: {
    width: "100%",
    height: 450,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionText: {
    textAlign: "center",
    fontSize: 16,
    color: "#777",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});

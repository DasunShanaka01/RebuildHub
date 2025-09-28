// @ts-nocheck
import { router } from "expo-router";

// interface Report {
//   id: string;
//   location: { latitude: number; longitude: number };
//   severity: "low" | "medium" | "high";
// }

// export default function Index() {
//   const [locationPermission, setLocationPermission] = useState(false);
//   const [user, setUser] = useState<import("firebase/auth").User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
//   const [reports, setReports] = useState<Report[]>([]);
//   const [isSafe, setIsSafe] = useState(true);

//   // Check Firebase auth session
//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (u) => {
//       setUser(u);
//       setLoading(false);
//     });
//     return unsubscribe;
//   }, []);

//   // Request location permission & get current location
//   useEffect(() => {
//     (async () => {
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       setLocationPermission(status === "granted");

//       if (status === "granted") {
//         const location = await Location.getCurrentPositionAsync({});
//         setUserLocation({
//           latitude: location.coords.latitude,
//           longitude: location.coords.longitude,
//         });
//       }
//     })();
//   }, []);

//   // Fetch reports from Firestore
//   useEffect(() => {
//     const fetchReports = async () => {
//       try {
//         const querySnapshot = await getDocs(collection(db, "reports"));
//         const reportsData: Report[] = querySnapshot.docs.map((doc) => ({
//           id: doc.id,
//           location: doc.data().location,
//           severity: doc.data().severity,
//         }));
//         setReports(reportsData);
//       } catch (error) {
//         console.error("Error fetching reports:", error);
//       }
//     };
//     fetchReports();
//   }, []);

//   // Check if user is in danger zone
//   useEffect(() => {
//     if (!userLocation || reports.length === 0) return;

//     const inDanger = reports.some((report) => {
//       const radius =
//         report.severity === "high" ? 1500 : report.severity === "medium" ? 1000 : 500;

//       const distance = getDistance(
//         userLocation.latitude,
//         userLocation.longitude,
//         report.location.latitude,
//         report.location.longitude
//       );

//       return distance <= radius;
//     });

//     setIsSafe(!inDanger);
//   }, [userLocation, reports]);

//   if (loading) return null;
//   if (!user) return <Redirect href="/login" />;

//   // Haversine formula to calculate distance between two coords
//   const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
//     const R = 6371000;
//     const φ1 = (lat1 * Math.PI) / 180;
//     const φ2 = (lat2 * Math.PI) / 180;
//     const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//     const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//     const a =
//       Math.sin(Δφ / 2) ** 2 +
//       Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//     return R * c;
//   };

//   return (
//     <View style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.title}>Welcome to RebuildHub</Text>
//         <Text style={[styles.subtitle, isSafe ? styles.safeText : styles.dangerText]}>
//           You are currently: {isSafe ? "Safe ✅" : "In Danger ⚠️"}
//         </Text>
//       </View>

//       {locationPermission && userLocation ? (
//         <MapView
//           style={styles.map}
//           provider={PROVIDER_GOOGLE}
//           initialRegion={{
//             latitude: userLocation.latitude,
//             longitude: userLocation.longitude,
//             latitudeDelta: 0.05,
//             longitudeDelta: 0.05,
//           }}
//           showsUserLocation={true}
//           minZoomLevel={2}
//           maxZoomLevel={20}
//         >
//           {reports.map((report) => (
//             <React.Fragment key={report.id}>
//               <Marker
//                 coordinate={report.location}
//                 title={`Report (${report.severity})`}
//               />
//               <Circle
//                 center={report.location}
//                 radius={
//                   report.severity === "high"
//                     ? 1500
//                     : report.severity === "medium"
//                     ? 1000
//                     : 500
//                 }
//                 fillColor={
//                   report.severity === "high"
//                     ? "rgba(255,0,0,0.3)"
//                     : report.severity === "medium"
//                     ? "rgba(255,165,0,0.3)"
//                     : "rgba(0,128,0,0.3)"
//                 }
//                 strokeColor={
//                   report.severity === "high"
//                     ? "red"
//                     : report.severity === "medium"
//                     ? "orange"
//                     : "green"
//                 }
//                 strokeWidth={2}
//               />
//             </React.Fragment>
//           ))}
//         </MapView>
//       ) : (
//         <Text style={styles.permissionText}>Requesting location permission...</Text>
//       )}

//       <Link href="/reportSubmit/report" style={styles.button}>
//         <Text style={styles.buttonText}>Go to Report</Text>  
//       </Link>
//       <Link href="/Emergency/popupScreen" style={styles.Redbutton}>
//         <Text style={styles.buttonText}>Emergency Button</Text>  
//       </Link>
      
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#eef2f5",
//     padding: 16,
//   },
//   header: {
//     backgroundColor: "#fff",
//     padding: 16,
//     borderRadius: 12,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 5,
//     elevation: 3,
//     marginBottom: 12,
//     alignItems: "center",
//   },
//   title: {
//     fontSize: 26,
//     fontWeight: "bold",
//     color: "#222",
//   },
//   subtitle: {
//     fontSize: 18,
//     marginTop: 8,
//   },
//   safeText: {
//     color: "green",
//     fontWeight: "600",
//   },
//   dangerText: {
//     color: "red",
//     fontWeight: "700",
//   },
//   map: {
//     width: "100%",
//     height: 400,
//     borderRadius: 12,
//     marginBottom: 16,
//   },
//   permissionText: {
//     textAlign: "center",
//     fontSize: 16,
//     color: "#777",
//     marginBottom: 16,
//   },
//   button: {
//     backgroundColor: "#2196F3",
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 8,
//     marginTop: 16,
//     textAlign: "center",
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "bold",
//     textAlign: "center",
//   },
//   Redbutton: {
//     backgroundColor: "#eb4949ff",
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 8,
//     marginTop: 16,
//     textAlign: "center",
//   },
// });


import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Link, Redirect } from "expo-router";
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig"; // adjust path
import { Picker } from "@react-native-picker/picker";

interface Report {
  id: string;
  location: { latitude: number; longitude: number };
  severity: "low" | "medium" | "high";
}

export default function Index() {
  const [locationPermission, setLocationPermission] = useState(false);
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isSafe, setIsSafe] = useState(true);

  // Check Firebase auth session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Request location permission & get current location
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

  // Fetch reports from Firestore (real-time) and normalize data
  useEffect(() => {
    const q = query(collection(db, "reportData"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reportsData: Report[] = snapshot.docs
          .map((d) => {
            const data: any = d.data();
            // Handle location stored as GeoPoint or as { latitude, longitude }
            let latitude: number | undefined;
            let longitude: number | undefined;
            if (data?.location) {
              if (typeof data.location.latitude === "number" && typeof data.location.longitude === "number") {
                latitude = data.location.latitude;
                longitude = data.location.longitude;
              } else if (typeof data.location._latitude === "number" && typeof data.location._longitude === "number") {
                // Some SDKs expose GeoPoint fields as _latitude/_longitude when serialized
                latitude = data.location._latitude;
                longitude = data.location._longitude;
              } else if (data.location?.latitude !== undefined && data.location?.longitude !== undefined) {
                latitude = Number(data.location.latitude);
                longitude = Number(data.location.longitude);
              }
            }
            const locOk = typeof latitude === "number" && typeof longitude === "number";
            const sevRaw = String(data?.severity ?? "medium");
            const sev = (sevRaw.toLowerCase() as Report["severity"]) || "medium";
            if (!locOk) return null;
            return {
              id: d.id,
              location: { latitude: latitude as number, longitude: longitude as number },
              severity: sev,
            } as Report;
          })
          .filter(Boolean) as Report[];
        setReports(reportsData);
      },
      (error) => {
        console.error("Error fetching reports:", error);
      }
    );
    return unsubscribe;
  }, []);

  // Check if user is in danger zone
  useEffect(() => {
    if (!userLocation || reports.length === 0) return;

    const inDanger = reports.some((report) => {
      const radius =
        report.severity === "high"
          ? 1500
          : report.severity === "medium"
          ? 1000
          : 500;

      const distance = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        report.location.latitude,
        report.location.longitude
      );

      return distance <= radius;
    });

    setIsSafe(!inDanger);

    // Track high severity zones the user is inside
    const insideHigh = reports
      .filter((r) => r.severity === "high")
      .filter((r) => {
        const distance = getDistance(
          userLocation.latitude,
          userLocation.longitude,
          r.location.latitude,
          r.location.longitude
        );
        return distance <= 1500;
      })
      .map((r) => r.location);
    setHighDangerZones(insideHigh);
  }, [userLocation, reports]);

  // Blink/pulse animation for high danger zones
  useEffect(() => {
    if (highDangerZones.length === 0) return;
    let mounted = true;
    let t = 0;
    const id = setInterval(() => {
      if (!mounted) return;
      // Smooth oscillation between 0.25 and 0.6 alpha
      t += 0.12;
      const a = 0.25 + (Math.sin(t) * 0.35 + 0.35) / 2; // ~0.25..0.6
      setPulseAlpha(Number(a.toFixed(3)));
    }, 60);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [highDangerZones.length]);

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  // Haversine formula
  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to RebuildHub</Text>
        <Text
          style={[styles.subtitle, isSafe ? styles.safeText : styles.dangerText]}
        >
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
          {reports.map((report) => {
            const colors = getSeverityColors(report.severity);
            return (
              <React.Fragment key={report.id}>
                <Marker coordinate={report.location} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                  <View style={styles.markerContainer}>
                    <View style={styles.markerShadow} />
                    <View style={[styles.markerPin, { backgroundColor: colors.main, borderColor: colors.dark }]}>
                      <Text style={styles.markerLabel}>
                        {report.severity === "high" ? "H" : report.severity === "medium" ? "M" : "L"}
                      </Text>
                    </View>
                    <View style={[styles.markerTail, { borderTopColor: colors.main }]} />
                    <View style={[styles.markerDot, { backgroundColor: colors.dark }]} />
                  </View>
                  <Callout tooltip>
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>Severity: {report.severity.toUpperCase()}</Text>
                      <Text style={styles.calloutSub}>{`lat ${report.location.latitude.toFixed(4)}, lng ${report.location.longitude.toFixed(4)}`}</Text>
                    </View>
                  </Callout>
                </Marker>
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
            );
          })}
          {/* Blinking circles for high-severity zones that include the user */}
          {highDangerZones.map((center, idx) => (
            <Circle
              key={`hz-${idx}`}
              center={center}
              radius={1500}
              fillColor={`rgba(255,0,0,${pulseAlpha})`}
              strokeColor={"red"}
              strokeWidth={2}
            />
          ))}
        </MapView>
      ) : (
        <Text style={styles.permissionText}>
          Requesting location permission...
        </Text>
      )}

      {/* Report Button */}
      <Link href="/reportSubmit/report" style={styles.button}>
        <Text style={styles.buttonText}>Go to Report</Text>
      </Link>

      {/* Emergency Button → opens popup */}
      <TouchableOpacity
        style={styles.Redbutton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>Emergency Button</Text>
      </TouchableOpacity>

      {/* Emergency Popup */}
      <Modal
        transparent={true}
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitleRed}> Emergency Aid 🚨</Text>

            <Text style={styles.modalText}>
              Please select the type of emergency:
            </Text>

            <Picker
              selectedValue={selectedEmergency}
              style={styles.picker}
              onValueChange={(itemValue) => setSelectedEmergency(itemValue)}
            >
              <Picker.Item label="Select Emergency " value="" />
              <Picker.Item label="Earthquakes" value="Earthquakes" />
              <Picker.Item label="Tsunamis" value="Tsunamis" />
              <Picker.Item label="Landslides" value="Landslides" />
              <Picker.Item label="Floods" value="Floods" />
              <Picker.Item label="Droughts" value="Droughts" />
              <Picker.Item label="Wildfires" value="Wildfires" />
            </Picker>

            {selectedEmergency ? (
              <Text style={styles.selectedText}>
                Selected: {selectedEmergency}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleSaveEmergency}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { marginTop: 10, backgroundColor: "gray" }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f5", padding: 16 },
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
  title: { fontSize: 26, fontWeight: "bold", color: "#222" },
  subtitle: { fontSize: 18, marginTop: 8 },
  safeText: { color: "green", fontWeight: "600" },
  dangerText: { color: "red", fontWeight: "700" },
  map: {
    width: "100%",
    height: 400,
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
    textAlign: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" ,textAlign: "center"},
  Redbutton: {
    backgroundColor: "#eb4949ff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    textAlign: "center",
  },
});

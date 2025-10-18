import { useRouter } from 'expo-router';

import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { Link, Redirect } from "expo-router";
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../FirebaseConfig";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";

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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState("");
  const [highDangerZones, setHighDangerZones] = useState<{ latitude: number; longitude: number }[]>([]);
  const [pulseAlpha, setPulseAlpha] = useState(0.35);
  const router = useRouter();
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [submittedType, setSubmittedType] = useState("");
  const [emergencies, setEmergencies] = useState<
  { id: string; type: string; location: { latitude: number; longitude: number } }[]
>([]);
  const [emergencyButtonBlink, setEmergencyButtonBlink] = useState(new Animated.Value(1));



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

  // Blinking animation for emergency button
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(emergencyButtonBlink, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(emergencyButtonBlink, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    blinkAnimation.start();
    return () => blinkAnimation.stop();
  }, []);

  useEffect(() => {
  const q = query(collection(db, "emergencies"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
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
      .filter(Boolean);
  // Remove any null entries (from docs without location) and ensure typing
  const filtered = data.filter((x): x is { id: string; type: string; location: { latitude: number; longitude: number } } => !!x);
  setEmergencies(filtered);
  });

  return unsubscribe;
}, []);

  // // Handle emergency submission
  // const handleSaveEmergency = () => {
  //   if (!selectedEmergency) {
  //     Alert.alert("Error", "Please select an emergency type");
  //     return;
  //   }
    
  //   Alert.alert(
  //     "Emergency Submitted",
  //     `Emergency type: ${selectedEmergency} has been reported. Help is on the way!`,
  //     [
  //       {
  //         text: "OK",
  //         onPress: () => {
  //           setModalVisible(false);
  //           setSelectedEmergency("");
  //         }
  //       }
  //     ]
  //   );
  // };


   const handleEmergencySubmit = async () => {
    if (!selectedEmergency) {
      Alert.alert("Error", "Please select an emergency type");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "emergencies"), {
        type: selectedEmergency,
        userId: user?.uid,
        location: userLocation,
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      setModalVisible(false);
      setSelectedEmergency("");
      
      // Redirect to QR code screen with the emergency ID
      // router.push({
      //   pathname: "/Emergency/QRCodeScreen",
      //   params: { emergencyId: docRef.id }
      // });
      Alert.alert("Emergency Reported", `Your emergency has been submitted. Emergency ID: ${docRef.id}`);
    } catch (error) {
      console.error("Error submitting emergency:", error);
      Alert.alert("Error", "Failed to submit emergency");
    }
  };

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


      <Animated.View style={{ opacity: emergencyButtonBlink }}>
        <TouchableOpacity
          style={styles.RedbuttonBlinking}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>Report an EMERGENCY</Text>
        </TouchableOpacity>
      </Animated.View>

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
          {emergencies.map((em) => (
            <React.Fragment key={`em-${em.id}`}>
              <Marker coordinate={em.location}>
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: "#4B0082", // deep purple
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: "#fff",
                      justifyContent: "center",
                      alignItems: "center",
                      transform: [{ scale: 1 }],
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>🚨</Text>
                  </View>
                </View>
                <Callout tooltip>
                  <View
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: "#4B0082",
                    }}
                  >
                    <Text style={{ fontWeight: "bold", color: "#4B0082" }}>Emergency</Text>
                    <Text style={{ color: "#333" }}>{em.type}</Text>
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
        <Text style={styles.permissionText}>
          Requesting location permission...
        </Text>
      )}

      {/* Report Button */}
      <Link href="/reportSubmit/report" style={styles.button}>
        <Text style={styles.buttonText}>Go to Report</Text>
      </Link>

      {/* Emergency Button → opens popup */}
      {/* <TouchableOpacity
        style={styles.Redbutton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>Emergency Button</Text>
      </TouchableOpacity> */}

      {/* Emergency Popup */}
      

    <Modal
      transparent={true}
      animationType="slide"
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitleRed}>Emergency 🚨</Text>
          <Text style={styles.modalText}>Select the type of disaster you are facing:</Text>

          {/* Disaster Type Buttons */}
          <View style={styles.emergencyButtonContainer}>
            {[
              "Earthquakes",
              "Tsunamis",
              "Landslides",
              "Floods",
              "Droughts",
              "Wildfires",
            ].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.emergencyButton,
                  selectedEmergency === type && styles.emergencyButtonSelected,
                ]}
                onPress={() => setSelectedEmergency(type)}
              >
                <Text style={styles.emergencyButtonText}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Confirm / Cancel Buttons */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20 }}>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: "green", width: "40%" }]}
              onPress={async () => {
                if (!selectedEmergency) {
                  Alert.alert("Please select a disaster type before confirming!");
                  return;
                }
                try {
                  await addDoc(collection(db, "emergencies"), {
                    type: selectedEmergency,
                    userId: user?.uid,
                    location: userLocation,
                    createdAt: serverTimestamp(),
                    status: "pending",
                  });

                  setSubmittedType(selectedEmergency);
                  setModalVisible(false);
                  setSuccessModalVisible(true); // show colorful success modal
                  setSelectedEmergency("");
                } catch (error) {
                  console.error("Error submitting emergency:", error);
                  Alert.alert("Error", "Failed to submit emergency");
                }
              }}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: "red", width: "40%" }]}
              onPress={() => {
                  setSelectedEmergency("");
                setModalVisible(false);
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Success Modal (Colorful Alert) */}
    <Modal
      transparent={true}
      animationType="fade"
      visible={successModalVisible}
      onRequestClose={() => setSuccessModalVisible(false)}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>Emergency Reported</Text>
          <Text style={styles.successMessage}>
            Your <Text style={{ fontWeight: "600" }}>{submittedType}</Text> emergency has been submitted. Emergency services have been notified.
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => setSuccessModalVisible(false)}
          >
            <Text style={styles.successButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    </View>
  );
}





const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc", 
    padding: 16,
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#1a202c",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 18, 
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  safeText: { 
    color: "#10b981", 
    fontWeight: "700",
    textShadowColor: "rgba(16, 185, 129, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dangerText: { 
    color: "#ef4444", 
    fontWeight: "800",
    textShadowColor: "rgba(239, 68, 68, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  map: {
    width: "100%",
    height: 420,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  permissionText: {
    textAlign: "center",
    fontSize: 16,
    color: "#64748b",
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 20,
    textAlign: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  buttonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "700", 
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  Redbutton: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 20,
    textAlign: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#dc2626",
  },
  RedbuttonBlinking: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 20,
    textAlign: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#dc2626",
    // Blinking animation will be handled by Animated.View
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "95%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalTitleRed: {
    fontSize: 24,
    fontWeight: "800",
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 0.5,
    textShadowColor: "rgba(220, 38, 38, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#374151",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  picker: {
    height: 50,
    marginBottom: 16,
    color: "#333",
  },
  selectedText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  closeButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  // Custom marker styles
  markerContainer: {
    alignItems: "center",
  },
  markerShadow: {
    position: "absolute",
    bottom: 0,
    width: 32,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    transform: [{ scaleX: 1.1 }],
  },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  markerLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
    marginTop: 2,
  },
  calloutBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderColor: "#e0e0e0",
    borderWidth: 1,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  calloutSub: {
    fontSize: 12,
    color: "#555",
  },

  pickerContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    zIndex: 1,
  },

  emergencyButtonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
    gap: 12,
    paddingHorizontal: 8,
  },

  emergencyButton: {
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    margin: 4,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    minWidth: 130,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  emergencyButtonSelected: {
    backgroundColor: "#fbbf24",
    borderColor: "#f59e0b",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },

  emergencyButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  emergencyButtonTextSelected: {
    color: "#92400e",
    fontWeight: "800",
  },

successOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.8)",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
},

successBox: {
  backgroundColor: "#fff",
  borderRadius: 20,
  padding: 28,
  width: "90%",
  maxWidth: 380,
  alignItems: "center",
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 16,
  elevation: 8,
  borderWidth: 1,
  borderColor: "#e2e8f0",
},

successEmoji: {
  fontSize: 56,
  marginBottom: 16,
  textShadowColor: "rgba(0, 0, 0, 0.1)",
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
},

successTitle: {
  fontSize: 22,
  fontWeight: "800",
  color: "#059669",
  marginBottom: 12,
  letterSpacing: 0.5,
  textAlign: "center",
},

successMessage: {
  fontSize: 16,
  color: "#374151",
  textAlign: "center",
  marginBottom: 24,
  lineHeight: 24,
  letterSpacing: 0.2,
},

successButton: {
  backgroundColor: "#10b981",
  paddingVertical: 14,
  paddingHorizontal: 32,
  borderRadius: 12,
  shadowColor: "#10b981",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
  borderWidth: 1,
  borderColor: "#059669",
},

successButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
  letterSpacing: 0.5,
  textShadowColor: "rgba(0, 0, 0, 0.2)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 1,
},

// Additional modern styles
statusIndicator: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 8,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  borderWidth: 1,
  borderColor: "#e2e8f0",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 2,
},

statusIcon: {
  fontSize: 16,
  marginRight: 6,
},

statusText: {
  fontSize: 14,
  fontWeight: "600",
  letterSpacing: 0.3,
},

mapContainer: {
  borderRadius: 16,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
  borderWidth: 2,
  borderColor: "#e2e8f0",
  marginBottom: 20,
},

buttonContainer: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 20,
  gap: 12,
},

primaryButton: {
  flex: 1,
  backgroundColor: "#3b82f6",
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 12,
  alignItems: "center",
  shadowColor: "#3b82f6",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
  borderWidth: 1,
  borderColor: "#2563eb",
},

secondaryButton: {
  flex: 1,
  backgroundColor: "#6b7280",
  paddingVertical: 14,
  paddingHorizontal: 20,
  borderRadius: 12,
  alignItems: "center",
  shadowColor: "#6b7280",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
  borderWidth: 1,
  borderColor: "#4b5563",
},

dangerZone: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  borderRadius: 16,
  borderWidth: 2,
  borderColor: "#ef4444",
  borderStyle: "dashed",
},

warningBanner: {
  backgroundColor: "#fef3c7",
  padding: 12,
  borderRadius: 8,
  marginBottom: 16,
  borderLeftWidth: 4,
  borderLeftColor: "#f59e0b",
  flexDirection: "row",
  alignItems: "center",
},

warningIcon: {
  fontSize: 20,
  color: "#f59e0b",
  marginRight: 8,
},

warningText: {
  flex: 1,
  color: "#92400e",
  fontSize: 14,
  fontWeight: "600",
  lineHeight: 20,
},

safeBanner: {
  backgroundColor: "#d1fae5",
  padding: 12,
  borderRadius: 8,
  marginBottom: 16,
  borderLeftWidth: 4,
  borderLeftColor: "#10b981",
  flexDirection: "row",
  alignItems: "center",
},

safeIcon: {
  fontSize: 20,
  color: "#10b981",
  marginRight: 8,
},

safeBannerText: {
  flex: 1,
  color: "#065f46",
  fontSize: 14,
  fontWeight: "600",
  lineHeight: 20,
},

loadingContainer: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#f8fafc",
},

loadingText: {
  fontSize: 16,
  color: "#64748b",
  marginTop: 12,
  fontWeight: "500",
},

spinner: {
  width: 40,
  height: 40,
  borderWidth: 4,
  borderColor: "#e2e8f0",
  borderTopColor: "#3b82f6",
  borderRadius: 20,
},

// Enhanced marker styles
enhancedMarker: {
  alignItems: "center",
  justifyContent: "center",
},

markerGlow: {
  position: "absolute",
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "rgba(59, 130, 246, 0.3)",
  shadowColor: "#3b82f6",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.8,
  shadowRadius: 10,
  elevation: 5,
},

// Card styles
infoCard: {
  backgroundColor: "#fff",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  borderWidth: 1,
  borderColor: "#e2e8f0",
},

cardTitle: {
  fontSize: 16,
  fontWeight: "700",
  color: "#1f2937",
  marginBottom: 8,
  letterSpacing: 0.3,
},

cardContent: {
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 20,
  letterSpacing: 0.2,
},

// Responsive design helpers
responsiveContainer: {
  paddingHorizontal: 16,
  paddingVertical: 12,
},

// Animation helpers
fadeIn: {
  opacity: 1,
},

fadeOut: {
  opacity: 0,
},

scaleIn: {
  transform: [{ scale: 1 }],
},

scaleOut: {
  transform: [{ scale: 0.95 }],
},

// Accessibility improvements
accessibleButton: {
  minHeight: 44,
  minWidth: 44,
  justifyContent: "center",
  alignItems: "center",
},

accessibleText: {
  fontSize: 16,
  fontWeight: "600",
  color: "#1f2937",
},

// Dark mode support (preparation)
darkContainer: {
  backgroundColor: "#111827",
},

darkText: {
  color: "#f9fafb",
},

darkCard: {
  backgroundColor: "#1f2937",
  borderColor: "#374151",
},

// Additional modern UI enhancements
glassmorphism: {
  backgroundColor: "rgba(255, 255, 255, 0.25)",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.18)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 4,
},

neonGlow: {
  shadowColor: "#00ff88",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.8,
  shadowRadius: 20,
  elevation: 8,
},

pulseAnimation: {
  shadowColor: "#ef4444",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 15,
  elevation: 6,
},

floatingButton: {
  position: "absolute",
  bottom: 20,
  right: 20,
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "#3b82f6",
  justifyContent: "center",
  alignItems: "center",
  shadowColor: "#3b82f6",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
  borderWidth: 2,
  borderColor: "#2563eb",
},

floatingButtonText: {
  color: "#fff",
  fontSize: 24,
  fontWeight: "bold",
},

badge: {
  position: "absolute",
  top: -8,
  right: -8,
  backgroundColor: "#ef4444",
  borderRadius: 10,
  width: 20,
  height: 20,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 2,
  borderColor: "#fff",
},

badgeText: {
  color: "#fff",
  fontSize: 12,
  fontWeight: "bold",
},

progressBar: {
  height: 8,
  backgroundColor: "#e2e8f0",
  borderRadius: 4,
  overflow: "hidden",
  marginVertical: 8,
},

progressFill: {
  height: "100%",
  backgroundColor: "#10b981",
  borderRadius: 4,
},

chip: {
  backgroundColor: "#f1f5f9",
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#e2e8f0",
  marginHorizontal: 4,
  marginVertical: 2,
},

chipText: {
  fontSize: 12,
  fontWeight: "600",
  color: "#374151",
},

divider: {
  height: 1,
  backgroundColor: "#e2e8f0",
  marginVertical: 16,
},

sectionHeader: {
  fontSize: 18,
  fontWeight: "700",
  color: "#1f2937",
  marginBottom: 12,
  marginTop: 20,
  letterSpacing: 0.3,
},

iconButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: "#f8fafc",
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#e2e8f0",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 2,
},

iconButtonPressed: {
  backgroundColor: "#e2e8f0",
  transform: [{ scale: 0.95 }],
},

tooltip: {
  position: "absolute",
  backgroundColor: "#1f2937",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  zIndex: 1000,
},

tooltipText: {
  color: "#fff",
  fontSize: 12,
  fontWeight: "500",
},

// Responsive breakpoints (for future use)
smallScreen: {
  padding: 12,
},

mediumScreen: {
  padding: 16,
},

largeScreen: {
  padding: 20,
},

// Animation presets
slideInFromRight: {
  transform: [{ translateX: 0 }],
},

slideInFromLeft: {
  transform: [{ translateX: 0 }],
},

slideInFromBottom: {
  transform: [{ translateY: 0 }],
},

bounceIn: {
  transform: [{ scale: 1 }],
},

rotateIn: {
  transform: [{ rotate: "0deg" }],
},

// Utility classes
textCenter: {
  textAlign: "center",
},

textLeft: {
  textAlign: "left",
},

textRight: {
  textAlign: "right",
},

flexRow: {
  flexDirection: "row",
},

flexColumn: {
  flexDirection: "column",
},

justifyCenter: {
  justifyContent: "center",
},

alignCenter: {
  alignItems: "center",
},

spaceBetween: {
  justifyContent: "space-between",
},

spaceAround: {
  justifyContent: "space-around",
},

flex1: {
  flex: 1,
},

flex2: {
  flex: 2,
},

flex3: {
  flex: 3,
},

// Color variants
primary: {
  backgroundColor: "#3b82f6",
  borderColor: "#2563eb",
},

secondary: {
  backgroundColor: "#6b7280",
  borderColor: "#4b5563",
},

success: {
  backgroundColor: "#10b981",
  borderColor: "#059669",
},

warning: {
  backgroundColor: "#f59e0b",
  borderColor: "#d97706",
},

danger: {
  backgroundColor: "#ef4444",
  borderColor: "#dc2626",
},

info: {
  backgroundColor: "#06b6d4",
  borderColor: "#0891b2",
},

});

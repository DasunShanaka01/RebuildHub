
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../FirebaseConfig';

interface EmergencyData {
  id: string;
  type: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: any;
  status: string;
  user: {
    name: string;
    email: string;
    address: string;
    phone: string;
  };
}

export default function QRCodeScreen() {
  const { emergencyId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmergencyData = async () => {
      try {
        const docRef = doc(db, "emergencies", emergencyId as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as EmergencyData;
          setEmergencyData(data);
        } else {
          setError("Emergency not found");
        }
      } catch (err) {
        setError("Failed to fetch emergency details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmergencyData();
  }, [emergencyId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

    const generateQRData = () => {
    if (!emergencyData) return '';

    const { location } = emergencyData;
    if (!location || !location.latitude || !location.longitude) return '';

    const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    let emergencyDetails = `Type: ${emergencyData.type}\n`;
    emergencyDetails += `Location: ${location.latitude}, ${location.longitude}\n`;
    emergencyDetails += `Status: ${emergencyData.status}\n`;
    emergencyDetails += `User: ${emergencyData.user.name} (${emergencyData.user.email})`;
    emergencyDetails += `\nPhone: ${emergencyData.user.phone}`;
    emergencyDetails += `\nAddress: ${emergencyData.user.address}`;


    return googleMapsLink + '\n' + emergencyDetails;
    };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.subtitle}>Loading emergency details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Emergency QR Code</Text>
      <Text style={styles.subtitle}>Scan this code to view emergency details</Text>
      <View style={styles.qrContainer}>
        <QRCode
          value={generateQRData()}
          size={250}
          backgroundColor="white"
          color="black"
        />
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.detailTitle}>Emergency Details:</Text>
        <Text style={styles.detailText}>ID: {emergencyId ? emergencyId : 'N/A'}</Text>
        <Text style={styles.detailText}>Type: {emergencyData?.type}</Text>
        <Text style={styles.detailText}>Created: {formatDate(emergencyData?.createdAt)}</Text>
        <Text style={styles.detailText}>Status: {emergencyData?.status}</Text>
        <Text style={styles.detailText}>Location: {emergencyData?.location.latitude}, {emergencyData?.location.longitude}</Text>
        <Text style={styles.detailText}>User: {emergencyData?.user.name} ({emergencyData?.user.email})</Text>
        <Text style={styles.detailText}>Phone: {emergencyData?.user.phone}</Text>
        <Text style={styles.detailText}>Address: {emergencyData?.user.address}</Text>
      </View>
    </SafeAreaView>
  );
}



 const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyId: {
        fontSize: 16,
        color: '#333',
        marginTop: 20,
    },
    error: {
        color: '#d32f2f',
        fontSize: 18,
        textAlign: 'center',
    },
    detailsContainer: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        paddingBottom: 30,
        paddingHorizontal: 20,
        gap: 5,
        marginBottom: 20,
        textAlign: 'center',
        
    },
    detailTitle: {
        fontSize: 23,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    detailText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,

    },
});
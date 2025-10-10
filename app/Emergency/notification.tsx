
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../FirebaseConfig';

export default function NotificationPage() {
  const [emergencies, setEmergencies] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const q = query(
      collection(db, "emergencies"),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emergencyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmergencies(emergencyList);
    }, (error) => {
      console.error("Error fetching emergencies:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleViewQR = (emergencyId) => {
    router.push({
      pathname: '/Emergency/QRCodeScreen',
      params: { emergencyId }
    });
  };

    const renderEmergencyCard = ({ item }) => (
      <View style={styles.card}>
        <Text style={styles.emergencyType}>
          Type: {item.type || 'Not specified'}
        </Text>
        <Text style={styles.timestamp}>
          Time: {item.createdAt?.toDate?.().toLocaleString() || 'Unknown'}
        </Text>
        {item.location?.latitude && item.location?.longitude ? (
          <Text style={styles.location}>
            Location: {item.location.latitude}, {item.location.longitude}
          </Text>
        ) : (
          <Text style={styles.location}>Location: Not available</Text>
        )}
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => handleViewQR(item.id)}
        >
          <Text style={styles.buttonText}>View QR Code</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Alerts</Text>
      {emergencies.length === 0 ? (
        <Text style={styles.noDataText}>No emergency alerts available</Text>
      ) : (
        <FlatList
          data={emergencies}
          renderItem={renderEmergencyCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  listContainer: {
    padding: 10,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 10,
  },
  emergencyType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 8,
  },
  location: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
  },
});


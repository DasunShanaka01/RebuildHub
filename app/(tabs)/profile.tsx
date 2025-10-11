import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { auth, db } from '../../FirebaseConfig';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';

const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        console.log('No user data found!');
      }
    } catch (error) {
      console.log('Error fetching user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Logout Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>My Profile 👤</Text>

      {userData ? (
        <View style={styles.card}>
          <Text style={styles.label}>Full Name:</Text>
          <Text style={styles.value}>{userData.name}</Text>

          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{userData.email}</Text>

          <Text style={styles.label}>Address:</Text>
          <Text style={styles.value}>{userData.address}</Text>

          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{userData.phone}</Text>
        </View>
      ) : (
        <Text style={styles.noData}>No user data found.</Text>
      )}

      {/* Buttons */}
      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.reportButton]} onPress={() => router.replace('/reportSubmit/reportProfile')}>
        <Text style={styles.buttonText}>View Your Reports</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.ngoButton]} onPress={() => router.replace('/reportSubmit/ngoReportViwe')}>
        <Text style={styles.buttonText}>Go to NGO Report View</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f4f6f9',
    alignItems: 'center',
    padding: 25,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 25,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
    marginTop: 10,
  },
  value: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2c3e50',
  },
  noData: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  logoutButton: { backgroundColor: '#e74c3c' },
  reportButton: { backgroundColor: '#3498db' },
  ngoButton: { backgroundColor: '#27ae60' },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f6f9',
  },
  loadingText: {
    marginTop: 10,
    color: '#7f8c8d',
    fontSize: 16,
  },
});

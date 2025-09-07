import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { auth } from '../../FirebaseConfig';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { router } from 'expo-router';

export default function NgoProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Logout Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NGO Profile</Text>
      <Text style={styles.subtitle}>Account details and settings.</Text>
      
      {user && (
        <Text style={styles.email}>Signed in as: {user.email}</Text>
      )}
      
      <Button title="Sign Out" onPress={handleLogout} color="red" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  email: {
    fontSize: 16,
    marginBottom: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});



// app/tabs/profile.tsx
import React, { useEffect, useState } from 'react';
import { View, Button, StyleSheet, Text, Alert } from 'react-native';
import { auth } from '../../FirebaseConfig';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { router } from 'expo-router';

const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Listen for auth state changes and set user
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login'); // redirect to login page
    } catch (error: any) {
      Alert.alert('Logout Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      {user && (
        <Text style={styles.email}>Signed in as: {user.email}</Text>
      )}
      <Button title="Logout" onPress={handleLogout} color="red" />

      <Button title="Go to Report" onPress={() => router.replace('/reportSubmit/reportProfile')} />

    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 16,
    marginBottom: 20,
    fontWeight: 'bold',
  },
});

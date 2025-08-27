import { StyleSheet, TouchableOpacity } from 'react-native';
import { auth } from '../../FirebaseConfig';
import { router } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { Text, View } from '@/components/Themed';
import { useEffect } from 'react';

export default function TabOneScreen() {

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wecome to RebuildHub</Text>
      <Text style={styles.title}>This is the home page</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 5,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

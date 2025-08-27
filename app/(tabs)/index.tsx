<<<<<<< HEAD
import { StyleSheet, View, Text } from 'react-native';
import { Link } from 'expo-router';
=======
import { StyleSheet, TouchableOpacity } from 'react-native';
import { auth } from '../../FirebaseConfig';
import { router } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { Text, View } from '@/components/Themed';
import { useEffect } from 'react';
>>>>>>> userRegistration

export default function TabOneScreen() {

  return (
    <View style={styles.container}>
<<<<<<< HEAD
      <Text style={styles.title}>Home</Text>
      <Link
        href={{ pathname: '/reportSubmit/[id]', params: { id: '1' } }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Go to Report</Text>
      </Link>
=======
      <Text style={styles.title}>Wecome to RebuildHub</Text>
      <Text style={styles.title}>This is the home page</Text>
>>>>>>> userRegistration
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
<<<<<<< HEAD
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
=======
  logoutButton: {
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 5,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
>>>>>>> userRegistration
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
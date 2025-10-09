import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { auth, db } from '../FirebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { router } from 'expo-router';

const Register = () => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signUp = async () => {
    if (!name || !address || !phone || !email || !password) {
      alert('Please fill all fields.');
      return;
    }

    try {
      // 1️⃣ Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2️⃣ Store user details in Firestore (linked by UID)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        address: address,
        phone: phone,
        email: email,
        createdAt: new Date(),
      });

      alert('Account created successfully!');
      router.replace('/login'); // redirect to login
    } catch (error: any) {
      console.log(error);
      alert('Sign Up Failed: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 25 }}>
        <Text style={styles.title}>Create Account 📝</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        <TextInput
          placeholder="Full Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Address"
          placeholderTextColor="#999"
          value={address}
          onChangeText={setAddress}
          style={styles.input}
        />
        <TextInput
          placeholder="Phone Number"
          placeholderTextColor="#999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity onPress={signUp} style={[styles.button, styles.signUpButton]}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#2980b9', fontWeight: '600' }}>
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Register;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dcdde1',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 16,
    color: '#2c3e50',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 3,
  },
  signUpButton: { backgroundColor: '#27ae60' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

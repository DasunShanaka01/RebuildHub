import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NgoAidScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Aid</Text>
      <Text style={styles.subtitle}>List and manage citizen aid here.</Text>
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
  },
});



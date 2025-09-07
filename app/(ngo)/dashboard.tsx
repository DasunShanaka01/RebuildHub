import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NgoDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NGO Overview</Text>
      <Text style={styles.subtitle}>Quick stats and recent activity will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f7f8fa',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});



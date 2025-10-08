import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams } from 'expo-router';
import BackButton from '../components/BackButton';

export default function EmergencyView() {
  const { id, type, lat, lng } = useLocalSearchParams();

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);

  return (
    <View style={styles.container}>
      <BackButton />
      <Text style={styles.title}>Emergency: {type}</Text>
      <Text style={styles.subtitle}>ID: {id}</Text>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: latitude,
          longitude: longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={type as string}
          description={`Emergency ID: ${id}`}
          pinColor="red"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  map: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').height * 0.7,
    borderRadius: 15,
  },
});

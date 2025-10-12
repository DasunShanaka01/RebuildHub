// import React from 'react';
// import { View, Text, StyleSheet } from 'react-native';

// export default function NgoDashboardScreen() {
//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>NGO Overview</Text>
//       <Text style={styles.subtitle}>Quick stats and recent activity will appear here.</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 16,
//     backgroundColor: '#f7f8fa',
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: '700',
//     marginBottom: 8,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#666',
//   },
// });

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function NgoDashboardScreen() {
  const router = useRouter();

  const handleNotificationPress = () => {
    router.push('/Emergency/notification');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={handleNotificationPress}
      >
        <Text style={styles.buttonText}>Emergency Notifications</Text>
      </TouchableOpacity>

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
  notificationButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

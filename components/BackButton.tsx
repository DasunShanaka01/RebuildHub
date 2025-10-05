import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';

// Option 1: Minimal Icon-Only Back Button (Recommended for clean look)
export default function BackButton() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
      <Text style={styles.iconOnly}>←</Text>
    </TouchableOpacity>
  );
}

// Option 2: Circular Icon Button (Uncomment to use)
/*
export default function BackButton() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity style={styles.circularButton} onPress={handleBack}>
      <Text style={styles.circularIcon}>←</Text>
    </TouchableOpacity>
  );
}
*/

// Option 3: Floating Action Button Style (Uncomment to use)
/*
export default function BackButton() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity style={styles.fabButton} onPress={handleBack}>
      <Text style={styles.fabIcon}>←</Text>
    </TouchableOpacity>
  );
}
*/

// Option 4: iOS-Style Text Button (Uncomment to use)
/*
export default function BackButton() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity style={styles.iosButton} onPress={handleBack}>
      <Text style={styles.iosIcon}>‹</Text>
      <Text style={styles.iosText}>Back</Text>
    </TouchableOpacity>
  );
}
*/

// Option 5: Outlined Button (Uncomment to use)
/*
export default function BackButton() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <TouchableOpacity style={styles.outlinedButton} onPress={handleBack}>
      <Text style={styles.outlinedIcon}>←</Text>
      <Text style={styles.outlinedText}>Back</Text>
    </TouchableOpacity>
  );
}
*/

const styles = StyleSheet.create({
  // Option 1: Minimal Icon-Only
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 16,
  },
  iconOnly: {
    fontSize: 28,
    color: '#1E293B',
    fontWeight: '600',
  },

  // Option 2: Circular Icon Button
  circularButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  circularIcon: {
    fontSize: 24,
    color: '#1E293B',
    fontWeight: '700',
  },

  // Option 3: Floating Action Button
  fabButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1000,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Option 4: iOS-Style
  iosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
    marginLeft: 12,
  },
  iosIcon: {
    fontSize: 32,
    color: '#2563EB',
    fontWeight: '400',
    marginRight: 2,
  },
  iosText: {
    fontSize: 17,
    color: '#2563EB',
    fontWeight: '400',
  },

  // Option 5: Outlined Button
  outlinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: 'transparent',
    marginBottom: 16,
    marginLeft: 16,
    alignSelf: 'flex-start',
  },
  outlinedIcon: {
    fontSize: 18,
    color: '#2563EB',
    marginRight: 4,
    fontWeight: '600',
  },
  outlinedText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
});
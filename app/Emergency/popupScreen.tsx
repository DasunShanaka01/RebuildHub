import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PopupScreenProps {
  // Add your props here
}

const PopupScreen: React.FC<PopupScreenProps> = () => {
  return (
    <View style={styles.container}>
      <Text>Popup Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PopupScreen;

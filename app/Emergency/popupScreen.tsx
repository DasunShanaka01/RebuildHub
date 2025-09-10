import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';

const EmergencyPopupScreen: React.FC = () => {
    const handleEmergencyPress = () => {
        Alert.alert('Emergency', 'Emergency services have been notified!');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Emergency Screen</Text>
            <Text style={styles.description}>
                If you are in an emergency situation, press the button below to notify emergency services.
            </Text>
            <Button title="Call Emergency" color="#d32f2f" onPress={handleEmergencyPress} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff3e0',
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 32,
    },
});

export default EmergencyPopupScreen;
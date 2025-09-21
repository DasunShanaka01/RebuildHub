# Aid Tab - Emergency Assistance Request System

## Overview
The Aid tab provides a comprehensive emergency assistance request system for users to request aid during disasters or emergencies.

## Features

### 📋 User Identification
- **Full Name** (required): User's complete name
- **NIC/National ID OR Phone Number** (required): Unique identifier for tracking requests
- **Household Size**: Number of people in the household

### 📍 Location Details
- **Address/Village Name** (required): Physical location description
- **GPS Location**: Auto-captured coordinates with manual input fallback
  - Tap the 📍 button to auto-capture current location
  - Manual entry available if GPS is unavailable

### 🆘 Aid Request Types
- **Food**: Checkbox for food assistance
- **Water**: Checkbox for water assistance  
- **Medicine**: Checkbox for medical supplies
- **Shelter**: Checkbox for temporary housing
- **Other**: Text field for additional needs

### 🚨 Urgency Level
- **Low**: Green indicator
- **Medium**: Orange indicator  
- **High**: Red indicator
- Visual color coding for easy recognition

### 📝 Additional Notes
- Optional text area for specific requirements
- Medical conditions, special needs, etc.

## Technical Implementation

### Firebase Integration
- **Collection**: `aid_requests`
- **Status**: Automatically set to "Requested"
- **Timestamps**: `createdAt` and `updatedAt` using server timestamps
- **Request ID**: Auto-generated Firestore document ID for tracking

### Data Flow
1. User fills out form
2. Form validation checks required fields
3. Data saved to Firestore
4. Confirmation shown with Request ID
5. Form resets for next use

### Location Services
- Uses Expo Location for GPS functionality
- Requests location permissions automatically
- Graceful fallback to manual input
- Balanced accuracy for optimal performance

## Usage Instructions

1. **Access**: Navigate to the "Aid" tab in the bottom navigation
2. **Request**: Tap "Request Aid" button
3. **Fill Form**: Complete all required fields (marked with *)
4. **GPS**: Use 📍 button to auto-capture location or enter manually
5. **Submit**: Tap "Submit Request" button
6. **Confirmation**: Note your Request ID for tracking

## Required Dependencies

```json
{
  "@react-native-picker/picker": "^2.6.1",
  "expo-location": "^18.0.1",
  "firebase": "^12.1.0"
}
```

## Firestore Schema

```typescript
interface AidRequest {
  fullName: string;
  identifier: string;
  householdSize: string;
  address: string;
  gpsLocation: string;
  aidTypes: {
    food: boolean;
    water: boolean;
    medicine: boolean;
    shelter: boolean;
    other: string;
  };
  urgencyLevel: 'Low' | 'Medium' | 'High';
  additionalNotes: string;
  status: 'Requested' | 'In Progress' | 'Delivered' | 'Cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Error Handling

- **Validation**: Required field checking before submission
- **Network**: Graceful error handling for Firebase operations
- **Location**: Permission and GPS availability fallbacks
- **User Feedback**: Clear success/error messages with actionable steps

## Future Enhancements

- **Status Tracking**: View request status updates
- **Push Notifications**: Real-time updates on request progress
- **Offline Support**: Queue requests when offline
- **Photo Attachments**: Document damage or needs
- **Emergency Contacts**: Quick access to emergency services

// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
// import QRCode from 'react-native-qrcode-svg';
// import { useLocalSearchParams } from 'expo-router';
// import { doc, getDoc } from 'firebase/firestore';
// import { db } from '../../FirebaseConfig';
// import BackButton from '../../components/BackButton';

// interface EmergencyData {
//     type: string;
//     userId: string;
//     location: {
//         latitude: number;
//         longitude: number;
//     } | null;
//     createdAt: any;
// }

// export default function QRCodeScreen() {
//     const { emergencyId } = useLocalSearchParams();
//     const [loading, setLoading] = useState(true);
//     const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(null);
//     const [error, setError] = useState<string | null>(null);

//     useEffect(() => {
//         const fetchEmergencyData = async () => {
//             try {
//                 const docRef = doc(db, "emergencies", emergencyId as string);
//                 const docSnap = await getDoc(docRef);
                
//                 if (docSnap.exists()) {
//                     const data = docSnap.data() as EmergencyData;
//                     setEmergencyData(data);
//                 } else {
//                     setError("Emergency not found");
//                 }
//             } catch (err) {
//                 setError("Failed to fetch emergency details");
//                 console.error(err);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchEmergencyData();
//     }, [emergencyId]);

//     const formatDate = (timestamp: any) => {
//         if (!timestamp) return 'N/A';
//         const date = timestamp.toDate();
//         return date.toLocaleString();
//     };


//     const generateQRData = () => {
//         if (!emergencyData || !emergencyData.location) return '';

//         const { latitude, longitude } = emergencyData.location;

//         // Google Maps link (works in any browser or phone)
//         const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

//         return googleMapsLink;
//     };



//     if (loading) {
//         return (
//             <SafeAreaView style={styles.container}>
//                 <BackButton />
//                 <View style={styles.content}>
//                     <ActivityIndicator size="large" color="#d32f2f" />
//                     <Text style={styles.subtitle}>Loading emergency details...</Text>
//                 </View>
//             </SafeAreaView>
//         );
//     }

//     if (error) {
//         return (
//             <SafeAreaView style={styles.container}>
//                 <BackButton />
//                 <View style={styles.content}>
//                     <Text style={styles.error}>{error}</Text>
//                 </View>
//             </SafeAreaView>
//         );
//     }

//     return (
//         <SafeAreaView style={styles.container}>
//             <BackButton />
//             <View style={styles.content}>
//                 <Text style={styles.title}>Emergency QR Code</Text>
//                 <Text style={styles.subtitle}>Scan this code to view emergency details</Text>
//                 <View style={styles.qrContainer}>
//                     <QRCode
//                         value={generateQRData()}
//                         size={250}
//                         backgroundColor="white"
//                         color="black"
//                     />
//                 </View>
//                 <View style={styles.detailsContainer}>
//                     <Text style={styles.detailTitle}>Emergency Details:</Text>
//                     <Text style={styles.detailText}>ID: {emergencyId}</Text>
//                     <Text style={styles.detailText}>Type: {emergencyData?.type}</Text>
//                     <Text style={styles.detailText}>Created: {formatDate(emergencyData?.createdAt)}</Text>
//                     {emergencyData?.location && (
//                         <Text style={styles.detailText}>
//                             Location: {emergencyData.location.latitude}, {emergencyData.location.longitude}
//                         </Text>
//                     )}
//                 </View>
//             </View>
//         </SafeAreaView>
//     );
// }

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: '#fff',
//     },
//     content: {
//         flex: 1,
//         alignItems: 'center',
//         justifyContent: 'center',
//         padding: 20,
//     },
//     title: {
//         fontSize: 24,
//         fontWeight: 'bold',
//         color: '#d32f2f',
//         marginBottom: 10,
//     },
//     subtitle: {
//         fontSize: 16,
//         color: '#666',
//         marginBottom: 30,
//         textAlign: 'center',
//     },
//     qrContainer: {
//         padding: 20,
//         backgroundColor: 'white',
//         borderRadius: 10,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 2 },
//         shadowOpacity: 0.25,
//         shadowRadius: 3.84,
//         elevation: 5,
//         marginBottom: 20,
//     },
//     emergencyId: {
//         fontSize: 16,
//         color: '#333',
//         marginTop: 20,
//     },
//     error: {
//         color: '#d32f2f',
//         fontSize: 18,
//         textAlign: 'center',
//     },
//     detailsContainer: {
//         width: '100%',
//         backgroundColor: '#f5f5f5',
//         padding: 15,
//         borderRadius: 10,
//         marginTop: 20,
//     },
//     detailTitle: {
//         fontSize: 18,
//         fontWeight: 'bold',
//         color: '#333',
//         marginBottom: 10,
//     },
//     detailText: {
//         fontSize: 16,
//         color: '#666',
//         marginBottom: 5,
//     },
// });



// // import React from 'react';
// // import { View, Text, StyleSheet } from 'react-native';
// // import QRCode from 'react-native-qrcode-svg';

// // interface QRCodeScreenProps {
// //   emergencyData: {
// //     type: string;
// //     timestamp: string;
// //     location?: {
// //       latitude: number;
// //       longitude: number;
// //     };
// //   };
// // }

// // const QRCodeScreen: React.FC<QRCodeScreenProps> = ({ emergencyData }) => {
// //   const qrData = JSON.stringify(emergencyData);

// //   return (
// //     <View style={styles.container}>
// //       <Text style={styles.title}>Emergency QR Code</Text>
// //       <View style={styles.qrContainer}>
// //         <QRCode
// //           value={qrData}
// //           size={250}
// //         />
// //       </View>
// //       <Text style={styles.info}>Emergency Type: {emergencyData.type}</Text>
// //       <Text style={styles.info}>Time: {emergencyData.timestamp}</Text>
// //     </View>
// //   );
// // };

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     backgroundColor: '#fff',
// //     padding: 20,
// //   },
// //   title: {
// //     fontSize: 24,
// //     fontWeight: 'bold',
// //     marginBottom: 30,
// //   },
// //   qrContainer: {
// //     padding: 20,
// //     backgroundColor: '#fff',
// //     borderRadius: 10,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: 2,
// //     },
// //     shadowOpacity: 0.25,
// //     shadowRadius: 3.84,
// //     elevation: 5,
// //     marginBottom: 20,
// //   },
// //   info: {
// //     fontSize: 16,
// //     marginTop: 10,
// //     color: '#666',
// //   },
// // });

// // export default QRCodeScreen;



import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../FirebaseConfig';

interface UserInfo {
  uid: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt?: any;
}

interface EmergencyData {
  id?: string;
  type: string;
  userId: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: any;
  status: string;
  user?: UserInfo;
}

export default function QRCodeScreen() {
  const { emergencyId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = async (userId: string): Promise<UserInfo | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data() as UserInfo;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchEmergencyData = async () => {
      try {
        if (!emergencyId) {
          setError("No emergency ID provided");
          setLoading(false);
          return;
        }

        const docRef = doc(db, "emergencies", emergencyId as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<EmergencyData, 'id' | 'user'>;
          console.log('Emergency data fetched:', data); // Debug log
          
          // Fetch user information if userId exists
          let userInfo: UserInfo | null = null;
          if (data.userId) {
            console.log('Fetching user info for userId:', data.userId);
            userInfo = await fetchUserInfo(data.userId);
            console.log('User info fetched:', userInfo); // Debug log
          } else {
            console.log('No userId found in emergency data');
          }
          
          const emergencyWithUser: EmergencyData = {
            id: emergencyId as string,
            ...data,
            user: userInfo || undefined
          };
          
          setEmergencyData(emergencyWithUser);
        } else {
          setError("Emergency not found");
        }
      } catch (err) {
        setError("Failed to fetch emergency details");
        console.error('Error fetching emergency data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmergencyData();
  }, [emergencyId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

    const generateQRData = () => {
    if (!emergencyData) return 'Emergency data not available';

    const { location } = emergencyData;
    let emergencyDetails = `Emergency ID: ${emergencyId}\n`;
    emergencyDetails += `Type: ${emergencyData.type}\n`;
    emergencyDetails += `Status: ${emergencyData.status}\n`;
    
    if (location && location.latitude && location.longitude) {
      const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
      emergencyDetails += `Location: ${location.latitude}, ${location.longitude}\n`;
      emergencyDetails = googleMapsLink + '\n' + emergencyDetails;
    } else {
      emergencyDetails += `Location: Not provided\n`;
    }
    
    // Safe access to user data
    if (emergencyData.user?.name) {
      emergencyDetails += `User: ${emergencyData.user.name} (${emergencyData.user.email || 'N/A'})`;
      if (emergencyData.user.phone) {
        emergencyDetails += `\nPhone: ${emergencyData.user.phone}`;
      }
      if (emergencyData.user.address) {
        emergencyDetails += `\nAddress: ${emergencyData.user.address}`;
      }
    } else {
      emergencyDetails += `User: Information not available`;
    }

    return emergencyDetails;
    };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.subtitle}>Loading emergency details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Emergency QR Code</Text>
      <Text style={styles.subtitle}>Scan this code to view emergency details</Text>
      <View style={styles.qrContainer}>
        <QRCode
          value={generateQRData()}
          size={250}
          backgroundColor="white"
          color="black"
        />
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.detailTitle}>Emergency Details:</Text>
        <Text style={styles.detailText}>ID: {emergencyId ? emergencyId : 'N/A'}</Text>
        <Text style={styles.detailText}>Type: {emergencyData?.type}</Text>
        <Text style={styles.detailText}>Created: {formatDate(emergencyData?.createdAt)}</Text>
        <Text style={styles.detailText}>Status: {emergencyData?.status}</Text>
        <Text style={styles.detailText}>Location: {emergencyData?.location?.latitude || 'N/A'}, {emergencyData?.location?.longitude || 'N/A'}</Text>
        {emergencyData?.user?.name ? (
          <>
            <Text style={styles.detailText}>User: {emergencyData.user.name} ({emergencyData.user.email || 'N/A'})</Text>
            {emergencyData.user.phone && (
              <Text style={styles.detailText}>Phone: {emergencyData.user.phone}</Text>
            )}
            {emergencyData.user.address && (
              <Text style={styles.detailText}>Address: {emergencyData.user.address}</Text>
            )}
          </>
        ) : (
          <Text style={styles.detailText}>User: Information not available</Text>
        )}
      </View>
    </SafeAreaView>
  );
}



 const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emergencyId: {
        fontSize: 16,
        color: '#333',
        marginTop: 20,
    },
    error: {
        color: '#d32f2f',
        fontSize: 18,
        textAlign: 'center',
    },
    detailsContainer: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        paddingBottom: 30,
        paddingHorizontal: 20,
        gap: 5,
        marginBottom: 20,
        textAlign: 'center',
        
    },
    detailTitle: {
        fontSize: 23,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    detailText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 5,

    },
});
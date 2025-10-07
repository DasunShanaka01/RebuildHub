import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../FirebaseConfig';
import QRCode from 'react-native-qrcode-svg';

export default function NotificationPage() {
  const { emergencyId } = useLocalSearchParams();
  const [emergencyData, setEmergencyData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchEmergencyData = async () => {
      if (emergencyId) {
        const docRef = doc(db, "emergencies", String(emergencyId));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEmergencyData({ id: docSnap.id, ...docSnap.data() });
        }
      }
    };
    fetchEmergencyData();
  }, [emergencyId]);

  const handleViewQR = () => {
    router.push({
      pathname: '/Emergency/QRCodeScreen',
      params: { emergencyId }
    });
  };

  if (!emergencyData) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading emergency details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Alert</Text>
      <View style={styles.card}>
        <Text style={styles.emergencyType}>
          Type: {emergencyData.type || 'Not specified'}
        </Text>
        <Text style={styles.timestamp}>
          Time: {emergencyData.createdAt?.toDate?.().toLocaleString() || 'Unknown'}
        </Text>
        {emergencyData.location && (
          <Text style={styles.location}>
            Location: {emergencyData.location.latitude}, {emergencyData.location.longitude}
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleViewQR}>
          <Text style={styles.buttonText}>View QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  emergencyType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 8,
  },
  location: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
});


// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import { doc, getDoc } from 'firebase/firestore';
// import { db } from '../../FirebaseConfig';
// import QRCode from 'react-native-qrcode-svg';

// interface NotificationModalProps {
//   visible: boolean;
//   onClose: () => void;
// }

// export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
//   const { emergencyId } = useLocalSearchParams();
//   const [emergencyData, setEmergencyData] = useState(null);
//   const router = useRouter();

//   useEffect(() => {
//     const fetchEmergencyData = async () => {
//       if (emergencyId) {
//         const docRef = doc(db, "emergencies", String(emergencyId));
//         const docSnap = await getDoc(docRef);
//         if (docSnap.exists()) {
//           setEmergencyData({ id: docSnap.id, ...docSnap.data() });
//         }
//       }
//     };
//     fetchEmergencyData();
//   }, [emergencyId]);

//   const handleViewQR = () => {
//     onClose();
//     router.push({
//       pathname: '/Emergency/QRCodeScreen',
//       params: { emergencyId }
//     });
//   };



// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
// import { useRouter } from 'expo-router';
// import { doc, getDoc } from 'firebase/firestore';
// import { db } from '../../FirebaseConfig';

// interface NotificationModalProps {
//   visible: boolean;
//   onClose: () => void;
//   emergencyId?: string;
// }

// export default function NotificationModal({ visible, onClose, emergencyId }: NotificationModalProps) {
//   const [emergencyData, setEmergencyData] = useState(null);
//   const router = useRouter();

//   useEffect(() => {
//     const fetchEmergencyData = async () => {
//       if (emergencyId) {
//         try {
//           const docRef = doc(db, "emergencies", String(emergencyId));
//           const docSnap = await getDoc(docRef);
//           if (docSnap.exists()) {
//             setEmergencyData({ id: docSnap.id, ...docSnap.data() });
//           }
//         } catch (error) {
//           console.error("Error fetching emergency data:", error);
//         }
//       }
//     };
    
//     if (visible && emergencyId) {
//       fetchEmergencyData();
//     }
//   }, [emergencyId, visible]);

//   const handleViewQR = () => {
//     if (onClose) onClose();
//     router.push({
//       pathname: '/Emergency/QRCodeScreen',
//       params: { emergencyId }
//     });
//   };

//   // ...rest of your existing return statement and Modal code...

//   return (
//     <Modal
//       animationType="slide"
//       transparent={true}
//       visible={visible}
//       onRequestClose={onClose}
//     >
//       <Pressable style={styles.overlay} onPress={onClose}>
//         <View style={styles.modalContainer}>
//           <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
//             <Text style={styles.title}>Emergency Alert</Text>
//             {!emergencyData ? (
//               <Text style={styles.loading}>Loading emergency details...</Text>
//             ) : (
//               <View style={styles.card}>
//                 <Text style={styles.emergencyType}>
//                   Type: {emergencyData.type || 'Not specified'}
//                 </Text>
//                 <Text style={styles.timestamp}>
//                   Time: {emergencyData.createdAt?.toDate?.().toLocaleString() || 'Unknown'}
//                 </Text>
//                 {emergencyData.location && (
//                   <Text style={styles.location}>
//                     Location: {emergencyData.location.latitude}, {emergencyData.location.longitude}
//                   </Text>
//                 )}
//                 <View style={styles.buttonContainer}>
//                   <TouchableOpacity style={styles.button} onPress={handleViewQR}>
//                     <Text style={styles.buttonText}>View QR Code</Text>
//                   </TouchableOpacity>
//                   <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
//                     <Text style={styles.buttonText}>Close</Text>
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             )}
//           </Pressable>
//         </View>
//       </Pressable>
//     </Modal>
//   );
// }

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContainer: {
//     width: '90%',
//     maxWidth: 400,
//   },
//   modalContent: {
//     backgroundColor: '#F1F5F9',
//     borderRadius: 16,
//     padding: 20,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//     elevation: 5,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#1E293B',
//     marginBottom: 20,
//     textAlign: 'center',
//   },
//   card: {
//     backgroundColor: '#FFFFFF',
//     padding: 20,
//     borderRadius: 12,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 3,
//     elevation: 3,
//   },
//   emergencyType: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#DC2626',
//     marginBottom: 10,
//   },
//   timestamp: {
//     fontSize: 16,
//     color: '#64748B',
//     marginBottom: 8,
//   },
//   location: {
//     fontSize: 16,
//     color: '#64748B',
//     marginBottom: 20,
//   },
//   buttonContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     gap: 10,
//   },
//   button: {
//     flex: 1,
//     backgroundColor: '#2563EB',
//     padding: 15,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   closeButton: {
//     backgroundColor: '#64748B',
//   },
//   buttonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   loading: {
//     fontSize: 16,
//     color: '#64748B',
//     textAlign: 'center',
//     padding: 20,
//   },
// });
// import React from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

// interface PopupScreenProps {
//   visible: boolean;
//   onClose: () => void;
//   onEmergencyCall: () => void;
// }

// const PopupScreen: React.FC<PopupScreenProps> = ({ visible, onClose, onEmergencyCall }) => {
//   return (
//     <Modal
//       animationType="slide"
//       transparent={true}
//       visible={visible}
//       onRequestClose={onClose}
//     >
//       <View style={styles.centeredView}>
//         <View style={styles.modalView}>
//           <Text style={styles.modalText}>Emergency Alert</Text>
//           <Text style={styles.descriptionText}>
//             Are you sure you want to make an emergency call?
//           </Text>
          
//           <View style={styles.buttonContainer}>
//             <TouchableOpacity
//               style={[styles.button, styles.emergencyButton]}
//               onPress={onEmergencyCall}
//             >
//               <Text style={styles.buttonText}>Call Emergency</Text>
//             </TouchableOpacity>
            
//             <TouchableOpacity
//               style={[styles.button, styles.cancelButton]}
//               onPress={onClose}
//             >
//               <Text style={styles.buttonText}>Cancel</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>
//     </Modal>
//   );
// };

// const styles = StyleSheet.create({
//   centeredView: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//   },
//   modalView: {
//     width: '80%',
//     backgroundColor: 'white',
//     borderRadius: 20,
//     padding: 35,
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//     elevation: 5,
//   },
//   modalText: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     marginBottom: 15,
//     textAlign: 'center',
//     color: '#FF0000',
//   },
//   descriptionText: {
//     fontSize: 16,
//     marginBottom: 20,
//     textAlign: 'center',
//   },
//   buttonContainer: {
//     width: '100%',
//     flexDirection: 'column',
//     gap: 10,
//   },
//   button: {
//     borderRadius: 10,
//     padding: 12,
//     width: '100%',
//     elevation: 2,
//   },
//   emergencyButton: {
//     backgroundColor: '#FF0000',
//   },
//   cancelButton: {
//     backgroundColor: '#808080',
//   },
//   buttonText: {
//     color: 'white',
//     fontWeight: 'bold',
//     textAlign: 'center',
//     fontSize: 16,
//   },
// });

// export default PopupScreen;
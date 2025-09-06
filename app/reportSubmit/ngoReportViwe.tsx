import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import BackButton from '../../components/BackButton';

export default function NGOReportView() {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reportData"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReports(data);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "reportData", id), { reportStatus: status });
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.category} - {item.severity}</Text>
      <Text>Description: {item.description}</Text>
      <Text>Status: {item.reportStatus}</Text>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#4CAF50" }]} onPress={() => updateStatus(item.id, "approved")}>
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#F44336" }]} onPress={() => updateStatus(item.id, "rejected")}>
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#2196F3" }]} onPress={() => updateStatus(item.id, "in-progress")}>
          <Text style={styles.btnText}>In Progress</Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#f9f9f9" }}>
        <BackButton />
      <Text style={styles.header}>NGO Dashboard</Text>
        
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#1A237E",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-around",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { addTrade } from "../utils/storage"; // ✅ ruta corregida

export default function HomeScreen() {
  const [signals, setSignals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ⚙️ URL NGROK
  const API_URL = "https://2c7964582762.ngrok-free.app/signals";

  // 🔄 Cargar señales
  const fetchSignals = async () => {
    try {
      const res = await fetch(API_URL + "?t=" + Date.now(), {
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.log("⚠️ No es JSON válido, contenido:", text);
        return;
      }

      if (data.status === "ok" && Array.isArray(data.data)) {
        const clean = data.data.map((s) => ({
          ...s,
          confidence_pct: parseFloat(s.confidence_pct || 0),
          confidence_display:
            s.confidence_display && s.confidence_display.trim() !== ""
              ? s.confidence_display
              : `${s.confidence_label} (${(
                  (s.confidence_pct || 0) * 100
                ).toFixed(0)}%)`,
          patterns:
            s.patterns && s.patterns.trim() !== ""
              ? s.patterns.split("|").join(", ")
              : "N/A",
          formattedDate: formatDate(s.timestamp),
          elapsed: calcElapsed(s.timestamp),
        }));
        setSignals(clean);
      } else {
        setSignals([]);
      }
    } catch (err) {
      console.log("❌ Error al obtener señales:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 10000);
    return () => clearInterval(interval);
  }, []);

  // 📅 Fecha local
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp + "Z");
      return date.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  // ⏳ Tiempo transcurrido
  const calcElapsed = (timestamp) => {
    try {
      const created = new Date(timestamp + "Z");
      const now = new Date();
      const diff = Math.floor((now - created) / 1000);
      if (diff < 60) return `hace ${diff}s`;
      if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
      if (diff < 86400)
        return `hace ${Math.floor(diff / 3600)} h ${Math.floor(
          (diff % 3600) / 60
        )} min`;
      return `hace ${Math.floor(diff / 86400)} días`;
    } catch {
      return "";
    }
  };

  // 🎨 Colores
  const getColor = (type) => {
    if (type === "CALL") return "#00FF99";
    if (type === "PUT") return "#FF4C4C";
    return "#CCCCCC";
  };

  const getConfidenceColor = (pct) => {
    if (pct >= 0.8) return "#00FF99"; // alta
    if (pct >= 0.6) return "#FFD700"; // media
    return "#FF4C4C"; // baja
  };

  // 🟢 Tomar operación
  const handleTake = async (item) => {
    const trade = {
      id: `${item.timestamp}-${item.symbol}-${item.timeframe}`,
      symbol: item.symbol,
      timeframe: item.timeframe,
      direction: item.direction,
      confidence_label: item.confidence_label,
      confidence_pct: item.confidence_pct,
      patterns: item.patterns,
      trend: item.trend,
      price: item.price,
      signal_timestamp: item.timestamp,
      takenAt: new Date().toISOString(),
      result: "pending",
    };

    try {
      const all = await addTrade(trade);
      console.log("✅ Operación tomada:", trade.id, "Total:", all.length);

      // 📢 Alerta visual
      Alert.alert(
        "Operación tomada",
        `✅ ${item.symbol} ${item.direction}\nGuardada en tu historial.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.log("⚠️ Error al guardar operación:", error);
      Alert.alert("Error", "No se pudo guardar la operación.");
    }
  };

  // 💫 Loading
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#00ff99" />
        <Text style={{ color: "#fff", marginTop: 10 }}>
          Cargando señales...
        </Text>
      </View>
    );
  }

  // 🧭 Render principal
  return (
    <View style={styles.container}>
      {/* Logo y título */}
      <View style={{ alignItems: "center", marginBottom: 15 }}>
    
        <Text style={styles.title}>📊 Señales Binarias Pro</Text>
      </View>

      {/* Lista de señales */}
      <FlatList
        data={signals}
        ListEmptyComponent={
          <Text style={styles.empty}>🚫 No hay señales recientes</Text>
        }
        keyExtractor={(item, index) =>
          `${item.symbol}-${item.timeframe}-${item.timestamp}-${index}`
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchSignals} />
        }
        renderItem={({ item }) => (
          <View
            style={[styles.card, { borderLeftColor: getColor(item.direction) }]}
          >
            <Text style={styles.symbol}>
              {item.symbol} | {item.timeframe}
            </Text>
            <Text
              style={[styles.direction, { color: getColor(item.direction) }]}
            >
              {item.direction} ({item.confidence_display})
            </Text>
            <Text style={styles.confidenceLabel}>
              🔹 Nivel de confianza:{" "}
              <Text style={{ color: getConfidenceColor(item.confidence_pct) }}>
                {item.confidence_display}
              </Text>
            </Text>
            <Text style={styles.text}>📈 Tendencia: {item.trend}</Text>
            <Text style={styles.text}>📊 Patrones: {item.patterns}</Text>
            <Text style={styles.text}>💰 Precio: {item.price}</Text>
            <Text style={styles.text}>📅 {item.formattedDate}</Text>
            <Text style={styles.text}>⏳ {item.elapsed}</Text>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => handleTake(item)}
            >
              <Text style={styles.btnText}>🟢 Tomar operación</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingTop: 40 },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    borderLeftWidth: 5,
  },
  symbol: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  direction: { fontSize: 16, fontWeight: "bold" },
  confidenceLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginVertical: 2,
  },
  text: { color: "#ccc", fontSize: 14 },
  empty: { color: "#777", textAlign: "center", marginTop: 20 },
  btn: {
    marginTop: 10,
    backgroundColor: "#00ff99",
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnText: { textAlign: "center", fontWeight: "bold", color: "#000" },
});

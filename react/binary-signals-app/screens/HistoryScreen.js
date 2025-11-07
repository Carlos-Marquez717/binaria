import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import {
  getTrades,
  updateTrade,
  deleteTrade,
  clearAllTrades,
} from "../utils/storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Picker } from "@react-native-picker/picker";

export default function HistoryScreen() {
  const [trades, setTrades] = useState([]);
  const [filteredTrades, setFilteredTrades] = useState([]);
  const [filters, setFilters] = useState({
    symbol: "",
    direction: "",
    trend: "",
    confidence: "",
    result: "",
  });
  const [options, setOptions] = useState({
    symbols: [],
    directions: [],
    trends: [],
    confidences: [],
    results: [],
  });

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    const data = await getTrades();
    setTrades(data);
    setFilteredTrades(data);
    buildOptions(data);
  };

  const buildOptions = (data) => {
    const unique = (key) => [
      ...new Set(
        data
          .map((t) =>
            key === "confidence"
              ? `${(t.confidence_pct * 100).toFixed(0)}%`
              : t[key]
          )
          .filter(Boolean)
      ),
    ];

    setOptions({
      symbols: unique("symbol"),
      directions: unique("direction"),
      trends: unique("trend"),
      confidences: unique("confidence"),
      results: unique("result"),
    });
  };

  // ✅ CORRECCIÓN AQUÍ → el filtrado evalúa todos los campos activamente
  const applyFilters = (filtersToApply, dataToFilter = trades) => {
    let filtered = dataToFilter;

    if (filtersToApply.symbol)
      filtered = filtered.filter((t) => t.symbol === filtersToApply.symbol);
    if (filtersToApply.direction)
      filtered = filtered.filter(
        (t) => t.direction === filtersToApply.direction
      );
    if (filtersToApply.trend)
      filtered = filtered.filter((t) => t.trend === filtersToApply.trend);
    if (filtersToApply.confidence)
      filtered = filtered.filter(
        (t) =>
          `${(t.confidence_pct * 100).toFixed(0)}%` ===
          filtersToApply.confidence
      );
    if (filtersToApply.result)
      filtered = filtered.filter((t) => t.result === filtersToApply.result);

    setFilteredTrades(filtered);
  };

  // ✅ CORRECCIÓN AQUÍ → actualiza filtros y luego aplica con el nuevo estado
  const handleChangeFilter = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    applyFilters(newFilters); // usa los nuevos filtros inmediatamente
  };

  const handleResult = async (id, result) => {
    const updated = await updateTrade(id, { result });
    setTrades(updated);
    applyFilters(filters, updated);
  };

  const handleDelete = async (id) => {
    Alert.alert("Eliminar operación", "¿Deseas eliminar esta operación?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const filtered = await deleteTrade(id);
          setTrades(filtered);
          applyFilters(filters, filtered);
          buildOptions(filtered);
        },
      },
    ]);
  };

  const handleClearAll = async () => {
    Alert.alert("Limpiar historial", "¿Eliminar TODAS las operaciones?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar todo",
        style: "destructive",
        onPress: async () => {
          await clearAllTrades();
          setTrades([]);
          setFilteredTrades([]);
          buildOptions([]);
        },
      },
    ]);
  };

  const exportToPDF = async () => {
    if (filteredTrades.length === 0) {
      Alert.alert("Sin datos", "No hay operaciones para exportar.");
      return;
    }

    const html = `
      <html>
      <head>
        <style>
          body { font-family: Arial; padding: 20px; color: #333; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 11px; }
          th { background-color: #f0f0f0; }
          tr:nth-child(even) { background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Historial de Operaciones</h1>
        <table>
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>Timeframe</th>
              <th>Dirección</th>
              <th>Tendencia</th>
              <th>Confianza</th>
              <th>Precio</th>
              <th>Resultado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTrades
              .map(
                (t) => `
              <tr>
                <td>${t.symbol}</td>
                <td>${t.timeframe}</td>
                <td>${t.direction}</td>
                <td>${t.trend}</td>
                <td>${(t.confidence_pct * 100).toFixed(0)}%</td>
                <td>${t.price}</td>
                <td>${t.result.toUpperCase()}</td>
                <td>${new Date(t.takenAt).toLocaleString("es-CL")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🕒 Historial de Operaciones</Text>

      {/* Botones principales */}
      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: "#00FF99" }]}
          onPress={exportToPDF}
        >
          <Text style={styles.headerText}>📤 Exportar PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: "#FF4C4C" }]}
          onPress={handleClearAll}
        >
          <Text style={styles.headerText}>🧹 Limpiar Todo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros dinámicos */}
      <View style={styles.filterContainer}>
        <Picker
          selectedValue={filters.symbol}
          style={styles.picker}
          dropdownIconColor="#00FF99"
          onValueChange={(v) => handleChangeFilter("symbol", v)}
        >
          <Picker.Item label="🔍 Filtrar por símbolo" value="" />
          {options.symbols.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <Picker
          selectedValue={filters.direction}
          style={styles.picker}
          dropdownIconColor="#00FF99"
          onValueChange={(v) => handleChangeFilter("direction", v)}
        >
          <Picker.Item label="📈 Dirección" value="" />
          {options.directions.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <Picker
          selectedValue={filters.trend}
          style={styles.picker}
          dropdownIconColor="#00FF99"
          onValueChange={(v) => handleChangeFilter("trend", v)}
        >
          <Picker.Item label="📊 Tendencia" value="" />
          {options.trends.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <Picker
          selectedValue={filters.confidence}
          style={styles.picker}
          dropdownIconColor="#00FF99"
          onValueChange={(v) => handleChangeFilter("confidence", v)}
        >
          <Picker.Item label="🎯 Confianza" value="" />
          {options.confidences.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
        </Picker>

        <Picker
          selectedValue={filters.result}
          style={styles.picker}
          dropdownIconColor="#00FF99"
          onValueChange={(v) => handleChangeFilter("result", v)}
        >
          <Picker.Item label="🏁 Resultado" value="" />
          {options.results.map((s) => (
            <Picker.Item key={s} label={s.toUpperCase()} value={s} />
          ))}
        </Picker>
      </View>

      {/* Lista */}
      {filteredTrades.length === 0 ? (
        <Text style={styles.empty}>Sin resultados.</Text>
      ) : (
        <FlatList
          data={filteredTrades}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.symbol}>
                {item.symbol} | {item.timeframe}
              </Text>
              <Text style={styles.text}>Dirección: {item.direction}</Text>
              <Text style={styles.text}>Tendencia: {item.trend}</Text>
              <Text style={styles.text}>
                Confianza: {(item.confidence_pct * 100).toFixed(0)}%
              </Text>
              <Text style={styles.text}>Precio: {item.price}</Text>
              <Text style={styles.text}>
                Resultado:{" "}
                <Text
                  style={{
                    color:
                      item.result === "win"
                        ? "#00FF99"
                        : item.result === "loss"
                        ? "#FF4C4C"
                        : "#FFD700",
                  }}
                >
                  {item.result.toUpperCase()}
                </Text>
              </Text>

              <View style={styles.buttons}>
                {item.result === "pending" && (
                  <>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: "#00FF99" }]}
                      onPress={() => handleResult(item.id, "win")}
                    >
                      <Text style={styles.btnText}>✅ Ganada</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: "#FF4C4C" }]}
                      onPress={() => handleResult(item.id, "loss")}
                    >
                      <Text style={styles.btnText}>❌ Perdida</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#555" }]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.btnText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
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
  headerButtons: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  headerText: { color: "#000", fontWeight: "bold" },
  filterContainer: { marginHorizontal: 10, marginBottom: 10 },
  picker: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 6,
    marginVertical: 3,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  symbol: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  text: { color: "#ccc", fontSize: 14 },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 4,
    marginBottom: 5,
  },
  btnText: { textAlign: "center", color: "#000", fontWeight: "bold" },
  empty: { color: "#777", textAlign: "center", marginTop: 20 },
});

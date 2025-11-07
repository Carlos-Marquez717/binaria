// screens/StatsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { getTrades } from "../utils/storage";

function getStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 dom
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  return new Date(d.setDate(diff));
}
function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function StatsScreen() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({
    daily: { total: 0, wins: 0, losses: 0, winrate: 0 },
    weekly: { total: 0, wins: 0, losses: 0, winrate: 0 },
    monthly: { total: 0, wins: 0, losses: 0, winrate: 0 },
  });

  const calc = (list, fromDate) => {
    const filtered = list.filter(
      (t) => new Date(t.takenAt) >= fromDate && t.result !== "pending"
    );
    const wins = filtered.filter((t) => t.result === "win").length;
    const losses = filtered.filter((t) => t.result === "loss").length;
    const total = wins + losses;
    return {
      total,
      wins,
      losses,
      winrate: total > 0 ? Math.round((wins / total) * 100) : 0,
    };
  };

  const load = async () => {
    const all = await getTrades();
    setTrades(all);

    const todayStart = getStartOfDay();
    const weekStart = getStartOfWeek();
    const monthStart = getStartOfMonth();

    setStats({
      daily: calc(all, todayStart),
      weekly: calc(all, weekStart),
      monthly: calc(all, monthStart),
    });
  };

  useEffect(() => {
    load();
    const int = setInterval(load, 10000); // refresca cada 10s
    return () => clearInterval(int);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📈 Estadísticas</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hoy</Text>
        <Text style={styles.num}>{stats.daily.winrate}% winrate</Text>
        <Text style={styles.label}>
          {stats.daily.wins} ganadas / {stats.daily.losses} perdidas
        </Text>
        <Text style={styles.label}>Total: {stats.daily.total}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Esta semana</Text>
        <Text style={styles.num}>{stats.weekly.winrate}% winrate</Text>
        <Text style={styles.label}>
          {stats.weekly.wins} ganadas / {stats.weekly.losses} perdidas
        </Text>
        <Text style={styles.label}>Total: {stats.weekly.total}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Este mes</Text>
        <Text style={styles.num}>{stats.monthly.winrate}% winrate</Text>
        <Text style={styles.label}>
          {stats.monthly.wins} ganadas / {stats.monthly.losses} perdidas
        </Text>
        <Text style={styles.label}>Total: {stats.monthly.total}</Text>
      </View>

      <View style={styles.cardSmall}>
        <Text style={styles.cardTitle}>Total histórico</Text>
        <Text style={styles.label}>Operaciones tomadas: {trades.length}</Text>
        <Text style={styles.label}>
          Operaciones cerradas:{" "}
          {trades.filter((t) => t.result !== "pending").length}
        </Text>
      </View>
    </ScrollView>
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
    marginHorizontal: 10,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
  },
  cardSmall: {
    backgroundColor: "#141414",
    marginHorizontal: 10,
    marginBottom: 50,
    padding: 14,
    borderRadius: 10,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  num: { color: "#00ff99", fontSize: 28, fontWeight: "bold", marginTop: 4 },
  label: { color: "#ccc", marginTop: 4 },
});

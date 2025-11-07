// utils/storage.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "TAKEN_TRADES_V1";

export async function getTrades() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.log("error getTrades", e);
    return [];
  }
}

export async function saveTrades(trades) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trades));
  } catch (e) {
    console.log("error saveTrades", e);
  }
}

export async function addTrade(trade) {
  const all = await getTrades();
  all.unshift(trade);
  await saveTrades(all);
  return all;
}

export async function updateTrade(id, patch) {
  const all = await getTrades();
  const updated = all.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await saveTrades(updated);
  return updated;
}

// 🗑️ Eliminar operación específica
export async function deleteTrade(id) {
  const all = await getTrades();
  const filtered = all.filter((t) => t.id !== id);
  await saveTrades(filtered);
  return filtered;
}

// ⚠️ Vaciar todo el historial
export async function clearAllTrades() {
  await AsyncStorage.removeItem(KEY);
}

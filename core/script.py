import os
import time
import warnings
import random
from datetime import datetime, timedelta

import pandas as pd
import numpy as np
import ta
from binance.client import Client

warnings.filterwarnings("ignore")

# ---------------- CONFIG ----------------
API_KEY = "XfR2NNWH5TL4v3sFl847LM57PHQl4VlRDzOaPNYYjhQ9LwHVcVhnaizORSwuN20j"
API_SECRET = "0lDJEwHWv7LyhgVj1gwZQxddwufSmz7P6pfB1cLIvtWqAVlVUb9ZmX9JKQobWiRP"

ACTIVOS = ["BTCUSDT", "EURUSD", "ETHUSDT", "SOLUSDT", "GBPJPY"]
TIMEFRAMES = ["3m", "5m"]
LIMIT = 200

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_CSV = os.path.join(BASE_DIR, "binary_signals_log_optimizado.csv")

# 🔹 Crear CSV si no existe (con encabezado extendido)
if not os.path.exists(LOG_CSV):
    with open(LOG_CSV, "w", encoding="utf-8") as f:
        f.write(
            "timestamp,symbol,timeframe,direction,confidence_label,confidence_pct,"
            "confidence_display,score,patterns,divergences,trend,price,"
            "duration_candles,duration_minutes,mtf_ok\n"
        )
    print("🆕 Archivo CSV creado automáticamente:", LOG_CSV)

# ---------------- CLIENTE ----------------
usar_binance = False
client = None
try:
    client = Client(API_KEY, API_SECRET)
    usar_binance = True
    print("✅ Conectado a Binance.")
except Exception:
    print("⚠️ Modo DEMO: sin conexión Binance (se usan datos simulados).")


# ---------------- FUNCIONES AUX ----------------
def now_utc():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def safe_get_klines(symbol, interval, limit=200):
    """
    Intenta obtener velas reales desde Binance.
    Si falla (forex u otro), genera datos DEMO.
    """
    if usar_binance:
        try:
            kl = client.get_klines(symbol=symbol, interval=interval, limit=limit)
            df = pd.DataFrame(
                kl,
                columns=[
                    "ts",
                    "open",
                    "high",
                    "low",
                    "close",
                    "volume",
                    "close_time",
                    "qv",
                    "nt",
                    "tb",
                    "tq",
                    "i",
                ],
            )
            df["timestamp"] = pd.to_datetime(df["ts"], unit="ms")
            df[["open", "high", "low", "close", "volume"]] = df[
                ["open", "high", "low", "close", "volume"]
            ].astype(float)
            return df[["timestamp", "open", "high", "low", "close", "volume"]]
        except Exception:
            pass

    # DEMO DATA (si no hay datos reales)
    end = datetime.utcnow()
    tf_min = int(interval[:-1])
    times = [end - timedelta(minutes=i * tf_min) for i in range(limit)][::-1]

    base = {"EURUSD": 1.08, "GBPJPY": 160.0}.get(
        symbol, 30000 + random.uniform(-2000, 2000)
    )
    noise = np.random.normal(
        0,
        0.0005 if symbol in ["EURUSD", "GBPJPY"] else 0.002,
        size=limit,
    ).cumsum()
    close = base * (1 + noise)
    high = close * (1 + np.random.uniform(0.0002, 0.0015, size=limit))
    low = close * (1 - np.random.uniform(0.0002, 0.0015, size=limit))
    openp = close * (1 + np.random.uniform(-0.0008, 0.0008, size=limit))
    volume = np.random.uniform(10, 1000, size=limit)

    return pd.DataFrame(
        {
            "timestamp": times,
            "open": openp,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        }
    )


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Añade EMAs, RSI, MACD, ADX, ATR, OBV, MOM, fuerza de vela, etc.
    """
    df = df.copy()

    df["EMA9"] = ta.trend.ema_indicator(df["close"], 9)
    df["EMA21"] = ta.trend.ema_indicator(df["close"], 21)
    df["EMA50"] = ta.trend.ema_indicator(df["close"], 50)
    df["EMA200"] = ta.trend.ema_indicator(df["close"], 200)

    df["RSI"] = ta.momentum.rsi(df["close"], 14)

    macd = ta.trend.MACD(df["close"])
    df["MACD"] = macd.macd()
    df["MACD_SIG"] = macd.macd_signal()

    df["ADX"] = ta.trend.adx(df["high"], df["low"], df["close"], 14)
    df["ATR"] = ta.volatility.average_true_range(
        df["high"], df["low"], df["close"], 14
    )

    # Volumen real aproximado
    df["OBV"] = ta.volume.on_balance_volume(df["close"], df["volume"])

    # Momentum
    df["MOM"] = ta.momentum.roc(df["close"], 5)

    # Fuerza de vela (cuerpo relativo al ATR)
    df["VELA_PODER"] = (
        (df["close"] - df["open"]).abs() / (df["ATR"] + 1e-9)
    )

    return df


def detectar_patrones(df: pd.DataFrame):
    """
    Martillo, shooting star, engulfing (muy simples).
    """
    patrones = []
    if len(df) < 3:
        return patrones

    o, c, h, l = df["open"], df["close"], df["high"], df["low"]
    body = abs(c.iloc[-1] - o.iloc[-1])

    if c.iloc[-1] >= o.iloc[-1]:
        lw = o.iloc[-1] - l.iloc[-1]
        uw = h.iloc[-1] - c.iloc[-1]
    else:
        lw = c.iloc[-1] - l.iloc[-1]
        uw = h.iloc[-1] - o.iloc[-1]

    if (lw > body * 2) and (uw < body * 0.5):
        patrones.append(("Martillo", "CALL"))
    if (uw > body * 2) and (lw < body * 0.5):
        patrones.append(("Shooting Star", "PUT"))

    if len(df) >= 2:
        # Bullish Engulfing
        if (c.iloc[-1] > o.iloc[-1]) and (c.iloc[-2] < o.iloc[-2]):
            patrones.append(("Bullish Engulfing", "CALL"))
        # Bearish Engulfing
        if (c.iloc[-1] < o.iloc[-1]) and (c.iloc[-2] > o.iloc[-2]):
            patrones.append(("Bearish Engulfing", "PUT"))

    return patrones


def detectar_divergencias(df: pd.DataFrame):
    """
    Divergencias simples con RSI y MACD (3 velas de separación).
    """
    divergencias = []
    if len(df) < 4:
        return divergencias

    c = df["close"]
    r = df["RSI"]
    m = df["MACD"]

    # Divergencia RSI Alcista: precio baja, RSI sube
    if c.iloc[-1] < c.iloc[-3] and r.iloc[-1] > r.iloc[-3]:
        divergencias.append(("Divergencia RSI Alcista", "CALL"))

    # Divergencia RSI Bajista: precio sube, RSI baja
    if c.iloc[-1] > c.iloc[-3] and r.iloc[-1] < r.iloc[-3]:
        divergencias.append(("Divergencia RSI Bajista", "PUT"))

    # Divergencia MACD Alcista
    if c.iloc[-1] < c.iloc[-3] and m.iloc[-1] > m.iloc[-3]:
        divergencias.append(("Divergencia MACD Alcista", "CALL"))

    # Divergencia MACD Bajista
    if c.iloc[-1] > c.iloc[-3] and m.iloc[-1] < m.iloc[-3]:
        divergencias.append(("Divergencia MACD Bajista", "PUT"))

    return divergencias


def estimar_duracion(df: pd.DataFrame) -> int:
    """
    Estima cuántas velas podría durar el movimiento.
    """
    if len(df) < 6:
        return 1

    # velocidad promedio últimos 5 cierres
    velocidad = abs(df["close"].iloc[-1] - df["close"].iloc[-5]) / 5
    if velocidad <= 0:
        return 1

    atr = df["ATR"].iloc[-1]
    duracion_velas = int(atr / velocidad)

    # clamp
    duracion_velas = max(1, min(10, duracion_velas))
    return duracion_velas


def score_avanzado(df: pd.DataFrame, direction: str, divergencias):
    """
    Score avanzado combinando EMAs, MACD, RSI, OBV, MOM, fuerza de vela, divergencias, etc.
    """
    score = 0

    # Tendencia corta
    if direction == "CALL":
        if df["EMA9"].iloc[-1] > df["EMA21"].iloc[-1]:
            score += 1
        if df["MACD"].iloc[-1] > df["MACD_SIG"].iloc[-1]:
            score += 1
    elif direction == "PUT":
        if df["EMA9"].iloc[-1] < df["EMA21"].iloc[-1]:
            score += 1
        if df["MACD"].iloc[-1] < df["MACD_SIG"].iloc[-1]:
            score += 1

    # Divergencias (muy fuertes)
    for div, ddir in divergencias:
        if ddir == direction:
            score += 2

    # OBV acompañando
    if len(df) >= 4:
        if (
            df["OBV"].iloc[-1] > df["OBV"].iloc[-3]
            and direction == "CALL"
        ):
            score += 1
        if (
            df["OBV"].iloc[-1] < df["OBV"].iloc[-3]
            and direction == "PUT"
        ):
            score += 1

    # Momentum
    if direction == "CALL" and df["MOM"].iloc[-1] > 0:
        score += 1
    if direction == "PUT" and df["MOM"].iloc[-1] < 0:
        score += 1

    # Fuerza de vela (cuerpo grande vs ATR)
    if df["VELA_PODER"].iloc[-1] > 0.7:
        score += 1

    # ADX (tendencia fuerte)
    if df["ADX"].iloc[-1] >= 25:
        score += 1

    return score


def classify_signal(score: int):
    """
    Clasificación de confianza según score total.
    Ajustado para el nuevo sistema.
    """
    if score >= 7:
        return "ALTA", 0.9
    elif score >= 4:
        return "MEDIA", 0.7
    else:
        return "BAJA", 0.5


def calcular_tendencia(df: pd.DataFrame) -> str:
    """
    Usa EMA50 vs EMA200 + ADX para clasificar tendencia general.
    """
    if pd.isna(df["EMA50"].iloc[-1]) or pd.isna(df["EMA200"].iloc[-1]):
        return "INDEFINIDA"

    if df["ADX"].iloc[-1] < 20:
        return "LATERAL"
    else:
        if df["EMA50"].iloc[-1] > df["EMA200"].iloc[-1]:
            return "ALCISTA"
        else:
            return "BAJISTA"


def construir_senal(df: pd.DataFrame, symbol: str, timeframe: str):
    """
    Construye una señal (CALL/PUT) con toda la info.
    Si CALL y PUT tienen el mismo score, devuelve None.
    """
    patrones = detectar_patrones(df)
    divergencias = detectar_divergencias(df)

    sc_call = score_avanzado(df, "CALL", divergencias)
    sc_put = score_avanzado(df, "PUT", divergencias)

    if sc_call == sc_put:
        return None  # sin ventaja clara

    if sc_call > sc_put:
        direction = "CALL"
        score = sc_call
    else:
        direction = "PUT"
        score = sc_put

    conf_label, conf_pct = classify_signal(score)
    conf_pct = float(conf_pct)
    confidence_display = f"{conf_label} ({conf_pct * 100:.0f}%)"

    trend = calcular_tendencia(df)
    price = float(df["close"].iloc[-1])

    duration_candles = estimar_duracion(df)
    tf_min = int(timeframe[:-1])
    duration_minutes = duration_candles * tf_min

    senal = {
        "timestamp": now_utc(),
        "symbol": symbol,
        "timeframe": timeframe,
        "direction": direction,
        "confidence_label": conf_label,
        "confidence_pct": conf_pct,
        "confidence_display": confidence_display,
        "score": score,
        "patterns": "|".join([p for p, _ in patrones]) if patrones else "",
        "divergences": "|".join([d for d, _ in divergencias])
        if divergencias
        else "",
        "trend": trend,
        "price": round(price, 6),
        "duration_candles": int(duration_candles),
        "duration_minutes": int(duration_minutes),
        "mtf_ok": False,  # se actualiza luego si 3m y 5m confirman
    }

    return senal


def validar_multitimeframe(sig3, sig5):
    """
    Valida que 3m y 5m vayan en la misma dirección y tengan buena confirmación.
    """
    if sig3 is None or sig5 is None:
        return None

    if sig3["direction"] != sig5["direction"]:
        return None

    if sig3["score"] < 3 or sig5["score"] < 3:
        return None

    if sig3["trend"] != sig5["trend"]:
        return None

    return sig3, sig5


# ---------------- LÓGICA PRINCIPAL ----------------
def update_signals():
    for sym in ACTIVOS:
        try:
            senales = {}

            # 1) construir señales por timeframe
            for tf in TIMEFRAMES:
                df_raw = safe_get_klines(sym, tf, LIMIT)
                df_ind = add_indicators(df_raw)
                senal = construir_senal(df_ind, sym, tf)
                senales[tf] = senal

            sig3 = senales.get("3m")
            sig5 = senales.get("5m")

            # 2) validación multi-timeframe
            valid = validar_multitimeframe(sig3, sig5)
            if not valid:
                print(
                    f"[{now_utc()}] {sym} -> ❌ 3m y 5m no confirman (dirección/tendencia/score)."
                )
                continue

            sig3, sig5 = valid
            sig3["mtf_ok"] = True
            sig5["mtf_ok"] = True

            # 3) Loguear ambas señales (3m y 5m) alineadas
            filas_log = [sig3, sig5]

            with open(LOG_CSV, "a", newline="", encoding="utf-8") as f:
                for row in filas_log:
                    df_row = pd.DataFrame([row])
                    df_row.to_csv(f, header=False, index=False)
                f.flush()
                os.fsync(f.fileno())

            # 4) Mostrar alerta clara en consola
            for row in filas_log:
                print(
                    f"[{row['timestamp']}] {row['symbol']} {row['timeframe']} "
                    f"MTF_OK ✅ -> {row['direction']} | {row['confidence_display']} | "
                    f"score={row['score']} | trend={row['trend']} | "
                    f"patrones={row['patterns']} | divs={row['divergences']} | "
                    f"duración≈{row['duration_candles']} velas (~{row['duration_minutes']} min)"
                )

        except Exception as e:
            print("⚠️ Error en", sym, ":", e)


# ---------------- LOOP PRINCIPAL ----------------
if __name__ == "__main__":
    print("🚀 Iniciando sistema BINARIAS (optimizado MTF + divergencias + volumen)...")
    while True:
        update_signals()
        # Ajusta este tiempo según qué tan frecuente quieras recalcular
        time.sleep(20)

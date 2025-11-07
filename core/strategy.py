import os, time, warnings, random
from datetime import datetime, timedelta
import pandas as pd, numpy as np, ta
from binance.client import Client

warnings.filterwarnings("ignore")

# ---------------- CONFIG ----------------
API_KEY = "XfR2NNWH5TL4v3sFl847LM57PHQl4VlRDzOaPNYYjhQ9LwHVcVhnaizORSwuN20j"
API_SECRET = "0lDJEwHWv7LyhgVj1gwZQxddwufSmz7P6pfB1cLIvtWqAVlVUb9ZmX9JKQobWiRP"
ACTIVOS = ["BTCUSDT", "EURUSD", "ETHUSDT", "SOLUSDT", "GBPJPY"]
TIMEFRAMES = ["3m", "5m"]
LIMIT = 200

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_CSV = os.path.join(BASE_DIR, "binary_signals_log.csv")

# 🔹 Crear CSV si no existe (con encabezado correcto)
if not os.path.exists(LOG_CSV):
    with open(LOG_CSV, "w", encoding="utf-8") as f:
        f.write("timestamp,symbol,timeframe,direction,confidence_label,confidence_pct,confidence_display,score,patterns,trend,price\n")
    print("🆕 Archivo CSV creado automáticamente:", LOG_CSV)

# ---------------- CLIENTE ----------------
usar_binance = False
client = None
try:
    client = Client(API_KEY, API_SECRET)
    usar_binance = True
    print("✅ Conectado a Binance.")
except Exception:
    print("⚠️ Modo DEMO: sin conexión Binance.")

# ---------------- FUNCIONES ----------------
def now_utc():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

def safe_get_klines(symbol, interval, limit=200):
    if usar_binance:
        try:
            kl = client.get_klines(symbol=symbol, interval=interval, limit=limit)
            df = pd.DataFrame(kl, columns=[
                'ts', 'open', 'high', 'low', 'close', 'volume',
                'close_time', 'qv', 'nt', 'tb', 'tq', 'i'])
            df['timestamp'] = pd.to_datetime(df['ts'], unit='ms')
            df[['open','high','low','close','volume']] = df[['open','high','low','close','volume']].astype(float)
            return df[['timestamp','open','high','low','close','volume']]
        except:
            pass

    # DEMO DATA
    end = datetime.utcnow()
    times = [end - timedelta(minutes=i*int(interval[:-1])) for i in range(limit)][::-1]
    base = {"EURUSD":1.08,"GBPJPY":160.0}.get(symbol,30000+random.uniform(-2000,2000))
    noise = np.random.normal(0,0.0005 if symbol in ["EURUSD","GBPJPY"] else 0.002,size=limit).cumsum()
    close = base*(1+noise)
    high = close*(1+np.random.uniform(0.0002,0.0015,size=limit))
    low  = close*(1-np.random.uniform(0.0002,0.0015,size=limit))
    openp= close*(1+np.random.uniform(-0.0008,0.0008,size=limit))
    volume = np.random.uniform(10,1000,size=limit)
    return pd.DataFrame({
        'timestamp':times,'open':openp,'high':high,'low':low,'close':close,'volume':volume
    })

def add_indicators(df):
    df['EMA9']=ta.trend.ema_indicator(df['close'],9)
    df['EMA21']=ta.trend.ema_indicator(df['close'],21)
    df['EMA50']=ta.trend.ema_indicator(df['close'],50)
    df['EMA200']=ta.trend.ema_indicator(df['close'],200)
    df['RSI']=ta.momentum.rsi(df['close'],14)
    macd=ta.trend.MACD(df['close'])
    df['MACD'],df['MACD_SIG']=macd.macd(),macd.macd_signal()
    df['ADX']=ta.trend.adx(df['high'],df['low'],df['close'],14)
    df['ATR']=ta.volatility.average_true_range(df['high'],df['low'],df['close'],14)
    return df

def detectar_patrones(df):
    patrones=[]
    if len(df)<3: return patrones
    o,c,h,l=df['open'],df['close'],df['high'],df['low']
    body=abs(c.iloc[-1]-o.iloc[-1])
    lw=(o.iloc[-1]-l.iloc[-1]) if c.iloc[-1]>=o.iloc[-1] else (c.iloc[-1]-l.iloc[-1])
    uw=(h.iloc[-1]-c.iloc[-1]) if c.iloc[-1]>=o.iloc[-1] else (h.iloc[-1]-o.iloc[-1])
    if (lw>body*2) and (uw<body*0.5): patrones.append(("Martillo","CALL"))
    if (uw>body*2) and (lw<body*0.5): patrones.append(("Shooting Star","PUT"))
    if len(df)>=2:
        if (c.iloc[-1]>o.iloc[-1]) and (c.iloc[-2]<o.iloc[-2]):
            patrones.append(("Bullish Engulfing","CALL"))
        if (c.iloc[-1]<o.iloc[-1]) and (c.iloc[-2]>o.iloc[-2]):
            patrones.append(("Bearish Engulfing","PUT"))
    return patrones

def confirmations_score(df, direction):
    score=0
    if direction=="CALL":
        if df['EMA9'].iloc[-1]>df['EMA21'].iloc[-1]: score+=1
        if df['MACD'].iloc[-1]>df['MACD_SIG'].iloc[-1]: score+=1
        if df['RSI'].iloc[-1]<65 and df['RSI'].iloc[-1]>df['RSI'].iloc[-2]: score+=1
    if direction=="PUT":
        if df['EMA9'].iloc[-1]<df['EMA21'].iloc[-1]: score+=1
        if df['MACD'].iloc[-1]<df['MACD_SIG'].iloc[-1]: score+=1
        if df['RSI'].iloc[-1]>35 and df['RSI'].iloc[-1]<df['RSI'].iloc[-2]: score+=1
    if df['ADX'].iloc[-1]>=25: score+=1
    if df['ATR'].iloc[-1]/df['close'].iloc[-1]>0.0008: score+=1
    return score

def classify_signal(score):
    if score>=4: return "ALTA",0.9
    elif score==3: return "MEDIA",0.7
    else: return "BAJA",0.5

def update_signals():
    for sym in ACTIVOS:
        for tf in TIMEFRAMES:
            try:
                df = add_indicators(safe_get_klines(sym, tf, LIMIT))
                patterns = detectar_patrones(df)
                sc_call = confirmations_score(df, "CALL")
                sc_put = confirmations_score(df, "PUT")
                if sc_call == sc_put:
                    continue

                direction = "CALL" if sc_call > sc_put else "PUT"
                score = max(sc_call, sc_put)
                conf_label, conf_pct = classify_signal(score)
                conf_pct = float(conf_pct)
                confidence_display = f"{conf_label} ({conf_pct * 100:.0f}%)"

                trend = "LATERAL" if df['ADX'].iloc[-1] < 20 else (
                    "ALCISTA" if df['EMA50'].iloc[-1] > df['EMA200'].iloc[-1] else "BAJISTA"
                )
                price = df['close'].iloc[-1]

                row = {
                    "timestamp": now_utc(),
                    "symbol": sym,
                    "timeframe": tf,
                    "direction": direction,
                    "confidence_label": conf_label,
                    "confidence_pct": conf_pct,
                    "confidence_display": confidence_display,
                    "score": score,
                    "patterns": "|".join([p for p, _ in patterns]),
                    "trend": trend,
                    "price": round(price, 6),
                }

                df_row = pd.DataFrame([row])
                with open(LOG_CSV, "a", newline="", encoding="utf-8") as f:
                    df_row.to_csv(f, header=False, index=False)
                    f.flush()
                    os.fsync(f.fileno())

                print(
                    f"[{now_utc()}] {sym} {tf} -> {direction} | {confidence_display} | "
                    f"score={score} | patterns={[p for p,_ in patterns]} | trend={trend}"
                )
            except Exception as e:
                print("⚠️", sym, tf, "error:", e)



def should_trigger_alert(tf: str) -> bool:
    now = datetime.utcnow()
    seconds = now.minute * 60 + now.second
    # cada 5 minutos (300 s) o 3 min (180 s)
    if tf == "5m":
        return (seconds % 300) >= 295  # últimos 5 segundos antes de nueva vela
    if tf == "3m":
        return (seconds % 180) >= 175
    return False                

# ---------------- LOOP PRINCIPAL ----------------
if __name__ == "__main__":
    print("🚀 Iniciando sistema BINARIAS (estrategia)...")
    while True:
        update_signals()
        time.sleep(20)

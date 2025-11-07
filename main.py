from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import os
from datetime import datetime, timezone

# ---------------- CONFIG ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_CSV = os.path.join(BASE_DIR, "core", "binary_signals_log.csv")

app = FastAPI(
    title="API de Señales Binarias",
    description="Entrega señales CALL/PUT generadas por el sistema Python.",
    version="1.4.0"
)

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- HOME ----------------
@app.get("/")
def home():
    return {
        "message": "API de señales binarias activa",
        "time": datetime.utcnow().isoformat()
    }

# ---------------- FUNCIONES AUXILIARES ----------------
def format_elapsed_time(timestamp_str):
    """Devuelve el tiempo transcurrido desde la señal (en texto legible)."""
    try:
        timestamp = datetime.strptime(str(timestamp_str), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        delta = now - timestamp
        sec = int(delta.total_seconds())
        if sec < 60:
            return f"hace {sec}s"
        elif sec < 3600:
            return f"hace {sec // 60} min"
        elif sec < 86400:
            return f"hace {sec // 3600}h {(sec % 3600) // 60}min"
        else:
            return f"hace {sec // 86400} días"
    except Exception:
        return ""

# ---------------- SEÑALES ----------------

@app.get("/signals")
def get_signals():
    """Devuelve las señales más recientes desde el CSV."""
    if not os.path.exists(LOG_CSV):
        return {"status": "waiting", "data": []}

    try:
        # 🔹 Leer CSV con encabezados conocidos
        df = pd.read_csv(
            LOG_CSV,
            names=[
                "timestamp", "symbol", "timeframe", "direction",
                "confidence_label", "confidence_pct", "confidence_display",
                "score", "patterns", "trend", "price"
            ],
            skiprows=1,  # salta la fila de encabezado duplicada
            encoding="utf-8",
            on_bad_lines="skip"
        )

        if df.empty:
            return {"status": "waiting", "data": []}

        # 🔹 Limpieza
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(subset=["symbol", "direction", "confidence_label"], inplace=True)

        # 🔹 Convertir numéricos
        df["confidence_pct"] = pd.to_numeric(df["confidence_pct"], errors="coerce").fillna(0.0)
        df["price"] = pd.to_numeric(df["price"], errors="coerce").round(6)

        # 🔹 Si falta el campo de visualización
        df["confidence_display"] = df.apply(
            lambda x: f"{x['confidence_label']} ({x['confidence_pct']*100:.0f}%)"
            if pd.notna(x["confidence_pct"]) else x["confidence_label"],
            axis=1
        )

        # 🔹 Color dinámico
        def conf_color(label):
            if label == "ALTA":
                return "#00FF99"
            elif label == "MEDIA":
                return "#FFD700"
            else:
                return "#FF4C4C"

        df["confidence_color"] = df["confidence_label"].apply(conf_color)

        # 🔹 Tiempo transcurrido legible
        def format_elapsed(ts):
            try:
                ts = datetime.strptime(str(ts), "%Y-%m-%d %H:%M:%S")
                delta = datetime.utcnow() - ts
                s = int(delta.total_seconds())
                if s < 60:
                    return f"hace {s}s"
                elif s < 3600:
                    return f"hace {s//60} min"
                elif s < 86400:
                    return f"hace {s//3600}h {(s%3600)//60}min"
                else:
                    return f"hace {s//86400}d"
            except Exception:
                return ""

        df["elapsed_time"] = df["timestamp"].apply(format_elapsed)

        # 🔹 Ordenar por fecha
        df = df.sort_values("timestamp", ascending=False).head(50)
        df = df.fillna("")

        data = df.to_dict(orient="records")

        return {
            "status": "ok",
            "count": len(data),
            "last_update": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "data": data,
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error al procesar CSV: {str(e)}",
            "data": [],
        }

    
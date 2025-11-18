import websocket
import json

DERIV_API_TOKEN = "ppYrssajXSvgXpo"  # pega tu token

def listar_activos_deriv():
    ws = websocket.create_connection(
        "wss://ws.derivws.com/websockets/v3?app_id=1089",
        header=[f"Authorization: Bearer {DERIV_API_TOKEN}"],
    )
    request = {
        "active_symbols": "brief",
        "product_type": "basic"  # puedes cambiar a 'multi' o 'all' si no ves muchos
    }
    ws.send(json.dumps(request))
    response = json.loads(ws.recv())
    ws.close()

    print("=== Activos disponibles ===")
    for s in response.get("active_symbols", []):
        print(f"{s['symbol']} -> {s['display_name']} ({s.get('market', '')})")

listar_activos_deriv()

import os
import requests
import hmac
import hashlib
import base64
import json
import time
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

GTI_USER = os.getenv("GTI_USER")
GTI_PASSWORD = os.getenv("GTI_PASSWORD")
API_URL = "https://gti.geofox.de/gti/public/getVehicleMap"

# Hamburg in 4 Kacheln
HAMBURG_AREA = {
    "lat_min": 53.39,  # Süden
    "lat_max": 53.75,  # Norden
    "lon_min": 9.70,  # Westen
    "lon_max": 10.35  # Osten
}

GRID_ROWS = 2
GRID_COLS = 2

VEHICLE_TYPES = [
    "METROBUS",
    "REGIONALBUS",
    "SCHNELLBUS",
    "NACHTBUS",
    "XPRESSBUS",
    "U_BAHN"
]
# hier können wir nochmal checken, ob wir auch alle Linien ohne ins limit zu rutschen ziehen können
TARGET_LINES = ["6", "7", "U3"]


def get_signature(body_payload, password):
    key = bytes(password, 'utf-8')
    message = bytes(json.dumps(body_payload, separators=(',', ':')), 'utf-8')
    hashed = hmac.new(key, message, hashlib.sha1)
    return base64.b64encode(hashed.digest()).decode('utf-8')


def generate_grid_boxes(area, rows, cols):
    boxes = []
    lat_step = (area["lat_max"] - area["lat_min"]) / rows
    lon_step = (area["lon_max"] - area["lon_min"]) / cols

    for r in range(rows):
        for c in range(cols):
            cur_lat_min = area["lat_min"] + (r * lat_step)
            cur_lat_max = cur_lat_min + lat_step
            cur_lon_min = area["lon_min"] + (c * lon_step)
            cur_lon_max = cur_lon_min + lon_step

            bbox = {
                "lowerLeft": {"x": cur_lon_min, "y": cur_lat_min, "type": "EPSG_4326"},
                "upperRight": {"x": cur_lon_max, "y": cur_lat_max, "type": "EPSG_4326"}
            }
            boxes.append(bbox)
    return boxes


def fetch_data_for_box(bbox):
    now_ts = int(time.time())

    payload = {
        "version": 62,
        "boundingBox": bbox,
        "periodBegin": now_ts - 60,
        "periodEnd": now_ts + 60,
        "vehicleTypes": VEHICLE_TYPES,
        "realtime": True,
        "withoutCoords": True
    }

    payload_json_str = json.dumps(payload, separators=(',', ':'))
    payload_bytes = payload_json_str.encode('utf-8')

    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json",
        "geofox-auth-user": GTI_USER,
        "geofox-auth-signature": get_signature(payload, GTI_PASSWORD),
        "geofox-auth-type": "HmacSHA1",
        "X-TraceId": str(uuid.uuid4()),
        "X-Platform": "web"
    }

    try:
        response = requests.post(
            API_URL,
            data=payload_bytes,
            headers=headers,
            timeout=15
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"   [!] Fehler {response.status_code}")
            print(f"   [!] Server-Antwort: {response.text}")
            return None

    except Exception as e:
        print(f"   [!] Exception: {e}")
        return None


def save_filtered_data(data, filename, box_index):
    if not data or "journeys" not in data:
        return

    relevant_journeys = []
    for journey in data["journeys"]:
        line_name = journey.get("line", {}).get("name")  #
        if line_name in TARGET_LINES:
            relevant_journeys.append(journey)

    if relevant_journeys:
        record = {
            "ingestion_iso": datetime.now().isoformat(),
            "box_index": box_index,  # beschreibt die genutzte Kachel
            "journeys": relevant_journeys
        }
        with open(filename, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
        print(f"   -> {len(relevant_journeys)} Treffer in Box {box_index} gespeichert.")


if __name__ == "__main__":
    print(f"Initialisiere Kacheln ({GRID_ROWS}x{GRID_COLS}) für Linien {TARGET_LINES}...")

    # 1. Kacheln
    grid_boxes = generate_grid_boxes(HAMBURG_AREA, GRID_ROWS, GRID_COLS)
    print(f"Hamburg unterteilt in {len(grid_boxes)} Sektoren.")

    filename = f"geofox_grid_{datetime.now().strftime('%Y-%m-%d')}.jsonl"

    try:
        while True:
            cycle_start = time.time()
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Starte neuen Zyklus...")

            # 2. Alle Kacheln durchgehen
            for i, bbox in enumerate(grid_boxes):
                data = fetch_data_for_box(bbox)

                if data and data.get("returnCode") == "OK":
                    save_filtered_data(data, filename, i + 1)
                elif data:
                    print(f"   [!] API Error: {data.get('errorText')}")

                # 3. Rate Limiting
                # Wir müssen >1 Sekunde warten zwischen den Boxen
                time.sleep(2.0)

            duration = time.time() - cycle_start
            wait_time = max(0, 30 - duration)  # Versuche einen 30-Sekunden-Takt zu halten

            print(f"Zyklus beendet in {duration:.2f}s. Warte {wait_time:.2f}s...")
            time.sleep(wait_time)

    except KeyboardInterrupt:
        print("\nIngestion beendet.")
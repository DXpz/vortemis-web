import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.getenv("VORTEMIS_API", "http://127.0.0.1:8000")
USER = os.getenv("VORTEMIS_USER", "admin_carles")
PASSWORD = os.getenv("VORTEMIS_PASS", "V0rt3mis!Demo2026")
THRESHOLD = 0.70
INTERVAL = float(os.getenv("VORTEMIS_SNAPSHOT_INTERVAL", "3.0"))
OUT = Path(__file__).resolve().parents[1] / "assets" / "detections.json"
MAX_POINTS = 60
RECENT = 6
STREAM = 6
SAMPLE = 200
DESTINATIONS = 6


def login() -> str:
    request = urllib.request.Request(
        API + "/v1/auth/login",
        data=json.dumps({"username": USER, "password": PASSWORD}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["access_token"]


def fetch(path: str, token: str):
    request = urllib.request.Request(
        API + path,
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


def top_destinations(sample: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for record in sample:
        destination = record["dst_ip"]
        counts[destination] = counts.get(destination, 0) + 1
    ordered = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return [
        {"dst_ip": address, "flows": count}
        for address, count in ordered[:DESTINATIONS]
    ]


def write(payload: dict) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temp = OUT.with_suffix(".tmp")
    temp.write_text(json.dumps(payload))
    os.replace(temp, OUT)


def main() -> None:
    token = None
    previous_total = None
    previous_time = None

    while True:
        try:
            if token is None:
                token = login()

            summary = fetch(f"/v1/stats/summary?threshold={THRESHOLD}", token)
            timeline = fetch(
                f"/v1/stats/timeline?threshold={THRESHOLD}&bucket_seconds=30",
                token,
            )
            recent = fetch(
                f"/v1/flows?min_probability={THRESHOLD}&limit={RECENT}", token
            )["records"]
            sample = fetch(f"/v1/flows?limit={SAMPLE}", token)["records"]
            engine = fetch("/v1/engine/metadata", token)

            now = time.time()
            total = summary["total_flows"]
            if previous_total is not None and now > previous_time:
                rate = (total - previous_total) / (now - previous_time)
            else:
                rate = 0.0
            previous_total, previous_time = total, now

            write(
                {
                    "generated_at": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                    ),
                    "total_flows": total,
                    "anomalies": summary["anomalies"],
                    "rate": round(max(rate, 0.0), 1),
                    "tactics": summary["by_tactic"],
                    "timeline": timeline[-MAX_POINTS:],
                    "recent": recent,
                    "stream": sample[:STREAM],
                    "destinations": top_destinations(sample),
                    "engine": engine,
                }
            )
        except urllib.error.HTTPError as error:
            token = None if error.code in (401, 403) else token
            time.sleep(1.0)
            continue
        except Exception:
            token = None
            time.sleep(1.0)
            continue
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()

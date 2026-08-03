"""Push normalized rows to the settlement service."""

import json
import urllib.request

ENDPOINT = "https://settlement.internal/v1/batch"


def post_batch(rows):
    """POST a batch. Returns the parsed response body."""
    payload = json.dumps({"rows": rows}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def upload_all(rows, batch_size=500):
    results = []
    for i in range(0, len(rows), batch_size):
        results.append(post_batch(rows[i : i + batch_size]))
    return results

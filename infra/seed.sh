#!/usr/bin/env bash
# Seed a small demo scenario via the REST API.
# Idempotent for masters (client/vehicle/mechanic): re-runs reuse existing rows by
# email/serial/fullName. Service orders are always created fresh.
set -euo pipefail

API="${API:-http://localhost:8080/api}"

need() { command -v "$1" > /dev/null 2>&1 || { echo "missing: $1"; exit 1; }; }
need curl
need jq

echo "==> seeding via $API"

# upsert <collection> <match-jq-filter> <payload-json>
#   GET /$collection, find first row matching $filter, else POST $payload. Echo id.
upsert() {
  local collection="$1" filter="$2" payload="$3" existing
  existing=$(curl -sf "$API/$collection" | jq -r "map(select($filter)) | .[0].id // empty")
  if [[ -n "$existing" ]]; then
    echo "$existing"
  else
    curl -sf -X POST "$API/$collection" -H 'content-type: application/json' -d "$payload" | jq -r .id
  fi
}

# --- Clients ------------------------------------------------------------
C1=$(upsert clients '.email=="info@edilombarda.it"' '{
  "name":"Edilizia Lombarda SpA","email":"info@edilombarda.it",
  "phone":"+39 02 1234567","vatNumber":"IT12345678901",
  "addressLine1":"Via Roma 1","city":"Milano","postalCode":"20121","country":"Italy"
}')
echo "client: Edilizia Lombarda → $C1"

C2=$(upsert clients '.email=="contact@costruzioniverdi.it"' '{
  "name":"Costruzioni Verdi Srl","email":"contact@costruzioniverdi.it",
  "vatNumber":"IT98765432109","city":"Bergamo","country":"Italy"
}')
echo "client: Costruzioni Verdi → $C2"

# --- Vehicles -----------------------------------------------------------
V1=$(upsert vehicles '.serialNumber=="CAT-320-SEED1"' '{
  "make":"Caterpillar","model":"320","serialNumber":"CAT-320-SEED1",
  "vehicleClass":"EXCAVATOR","status":"AVAILABLE","engineHours":1850.5
}')
V2=$(upsert vehicles '.serialNumber=="KOM-D85-SEED1"' '{
  "make":"Komatsu","model":"D85","serialNumber":"KOM-D85-SEED1",
  "vehicleClass":"DOZER","status":"AVAILABLE","engineHours":2100.0
}')
echo "vehicles: $V1, $V2"

# --- Mechanics ----------------------------------------------------------
M1=$(upsert mechanics '.fullName=="Marco Rossi"' '{
  "fullName":"Marco Rossi","phone":"+39 333 1234567",
  "skills":["HYDRAULICS","ENGINE"],"status":"IDLE",
  "location":{"lat":45.4642,"lng":9.1900}
}')
M2=$(upsert mechanics '.fullName=="Luca Bianchi"' '{
  "fullName":"Luca Bianchi","skills":["ENGINE","ELECTRICAL"],"status":"IDLE",
  "location":{"lat":45.5000,"lng":9.2500}
}')
M3=$(upsert mechanics '.fullName=="Giulia Neri"' '{
  "fullName":"Giulia Neri","skills":["HYDRAULICS"],"status":"OFF_DUTY",
  "location":{"lat":45.4500,"lng":9.1800}
}')
echo "mechanics: $M1, $M2, $M3"

# --- Sites (nested under client) ----------------------------------------
# upsert_site <clientId> <siteName> <payload>
upsert_site() {
  local cid="$1" name="$2" payload="$3" existing
  existing=$(curl -sf "$API/clients/$cid/sites" | jq -r "map(select(.name==\"$name\")) | .[0].id // empty")
  if [[ -n "$existing" ]]; then
    echo "$existing"
  else
    curl -sf -X POST "$API/clients/$cid/sites" -H 'content-type: application/json' -d "$payload" | jq -r .id
  fi
}

S1=$(upsert_site "$C1" "Cantiere Milano Centro" '{
  "name":"Cantiere Milano Centro","lat":45.47,"lng":9.20,
  "locationLabel":"Via Roma 1, Milano"
}')
S2=$(upsert_site "$C2" "Cantiere Bergamo Ovest" '{
  "name":"Cantiere Bergamo Ovest","lat":45.48,"lng":9.22,
  "locationLabel":"Bergamo"
}')
echo "sites: $S1, $S2"

# --- Service orders -----------------------------------------------------
# 1. Completed hydraulic job assigned to Marco
SO1=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V1\",\"clientId\":\"$C1\",\"siteId\":\"$S1\",\"vmrsCode\":\"042001010\",
  \"notes\":\"Demo hydraulic\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO1/quote"    > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/approve"  > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/dispatch" -H 'content-type: application/json' -d "{\"mechanicId\":\"$M1\"}" > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/start"    > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/complete" -H 'content-type: application/json' -d '{"actualMinutes":135}' > /dev/null
echo "service-order (COMPLETED): $SO1"

# 2. Pending alternator job (left at QUOTED so the UI shows action buttons)
SO2=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V2\",\"clientId\":\"$C2\",\"siteId\":\"$S2\",\"vmrsCode\":\"060001003\",
  \"notes\":\"Demo alternator\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO2/quote" > /dev/null
echo "service-order (QUOTED):    $SO2"

# 3. Approved track job, ready to dispatch
SO3=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V1\",\"clientId\":\"$C1\",\"siteId\":\"$S1\",\"vmrsCode\":\"033004001\",
  \"notes\":\"Demo track tension\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO3/quote"   > /dev/null
curl -sf -X POST "$API/service-orders/$SO3/approve" > /dev/null
echo "service-order (APPROVED):  $SO3"

echo ""
echo "==> seed complete. Open http://localhost:5173/"

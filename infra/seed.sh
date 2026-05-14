#!/usr/bin/env bash
# Seed a small demo scenario via the REST API.
# Idempotent-ish: every run inserts new rows; use `just db-reset` first for a clean slate.
set -euo pipefail

API="${API:-http://localhost:8080/api}"

need() { command -v "$1" > /dev/null 2>&1 || { echo "missing: $1"; exit 1; }; }
need curl
need jq

echo "==> seeding via $API"

# --- Clients ------------------------------------------------------------
C1=$(curl -sf -X POST "$API/clients" -H 'content-type: application/json' -d '{
  "name":"Edilizia Lombarda SpA","email":"info@edilombarda.it",
  "phone":"+39 02 1234567","vatNumber":"IT12345678901",
  "addressLine1":"Via Roma 1","city":"Milano","postalCode":"20121","country":"Italy"
}' | jq -r .id)
echo "client: Edilizia Lombarda → $C1"

C2=$(curl -sf -X POST "$API/clients" -H 'content-type: application/json' -d '{
  "name":"Costruzioni Verdi Srl","email":"contact@costruzioniverdi.it",
  "vatNumber":"IT98765432109","city":"Bergamo","country":"Italy"
}' | jq -r .id)
echo "client: Costruzioni Verdi → $C2"

# --- Vehicles -----------------------------------------------------------
V1=$(curl -sf -X POST "$API/vehicles" -H 'content-type: application/json' -d '{
  "make":"Caterpillar","model":"320","serialNumber":"CAT-320-SEED1",
  "vehicleClass":"EXCAVATOR","status":"AVAILABLE","engineHours":1850.5
}' | jq -r .id)
V2=$(curl -sf -X POST "$API/vehicles" -H 'content-type: application/json' -d '{
  "make":"Komatsu","model":"D85","serialNumber":"KOM-D85-SEED1",
  "vehicleClass":"DOZER","status":"AVAILABLE","engineHours":2100.0
}' | jq -r .id)
echo "vehicles: $V1, $V2"

# --- Mechanics ----------------------------------------------------------
M1=$(curl -sf -X POST "$API/mechanics" -H 'content-type: application/json' -d '{
  "fullName":"Marco Rossi","phone":"+39 333 1234567",
  "skills":["HYDRAULICS","ENGINE"],"status":"IDLE",
  "location":{"lat":45.4642,"lng":9.1900}
}' | jq -r .id)
M2=$(curl -sf -X POST "$API/mechanics" -H 'content-type: application/json' -d '{
  "fullName":"Luca Bianchi","skills":["ENGINE","ELECTRICAL"],"status":"IDLE",
  "location":{"lat":45.5000,"lng":9.2500}
}' | jq -r .id)
M3=$(curl -sf -X POST "$API/mechanics" -H 'content-type: application/json' -d '{
  "fullName":"Giulia Neri","skills":["HYDRAULICS"],"status":"OFF_DUTY",
  "location":{"lat":45.4500,"lng":9.1800}
}' | jq -r .id)
echo "mechanics: $M1, $M2, $M3"

# --- Service orders -----------------------------------------------------
# 1. Completed hydraulic job assigned to Marco
SO1=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V1\",\"clientId\":\"$C1\",\"vmrsCode\":\"042001010\",
  \"siteLocation\":{\"lat\":45.47,\"lng\":9.20},\"notes\":\"Demo hydraulic\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO1/quote"    > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/approve"  > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/dispatch" -H 'content-type: application/json' -d "{\"mechanicId\":\"$M1\"}" > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/start"    > /dev/null
curl -sf -X POST "$API/service-orders/$SO1/complete" -H 'content-type: application/json' -d '{"actualMinutes":135}' > /dev/null
echo "service-order (COMPLETED): $SO1"

# 2. Pending alternator job (left at QUOTED so the UI shows action buttons)
SO2=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V2\",\"clientId\":\"$C2\",\"vmrsCode\":\"060001003\",
  \"siteLocation\":{\"lat\":45.48,\"lng\":9.22},\"notes\":\"Demo alternator\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO2/quote" > /dev/null
echo "service-order (QUOTED):    $SO2"

# 3. Approved track job, ready to dispatch
SO3=$(curl -sf -X POST "$API/service-orders" -H 'content-type: application/json' -d "{
  \"vehicleId\":\"$V1\",\"clientId\":\"$C1\",\"vmrsCode\":\"033004001\",
  \"siteLocation\":{\"lat\":45.46,\"lng\":9.19},\"notes\":\"Demo track tension\"
}" | jq -r .id)
curl -sf -X POST "$API/service-orders/$SO3/quote"   > /dev/null
curl -sf -X POST "$API/service-orders/$SO3/approve" > /dev/null
echo "service-order (APPROVED):  $SO3"

echo ""
echo "==> seed complete. Open http://localhost:5173/"

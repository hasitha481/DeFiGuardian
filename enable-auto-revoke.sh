#!/bin/bash

ACCOUNT_ADDRESS="0xf7f3B8bb370Cd0062eA366c17C79cFecB17E406A"

echo "🔧 Enabling auto-revoke with threshold 70..."
curl -s -X PUT http://localhost:5000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "accountAddress": "'$ACCOUNT_ADDRESS'",
    "riskThreshold": 70,
    "autoRevokeEnabled": true,
    "notificationsEnabled": true,
    "whitelistedAddresses": []
  }'

echo ""
echo "✅ Settings updated"

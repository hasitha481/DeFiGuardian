#!/bin/bash

echo "🧪 Testing Gasless Transaction Flow for DeFi Guardian"
echo "=================================================="
echo ""

# Get smart account address
ACCOUNT_ADDRESS="0xf7f3B8bb370Cd0062eA366c17C79cFecB17E406A"

echo "1️⃣ Creating high-risk approval event (should trigger auto-revoke)..."
RESPONSE=$(curl -s -X POST http://localhost:5000/api/events/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "accountAddress": "'$ACCOUNT_ADDRESS'",
    "eventType": "approval",
    "tokenAddress": "0x1234567890123456789012345678901234567890",
    "tokenSymbol": "SCAM",
    "spenderAddress": "0x9999999999999999999999999999999999999999",
    "amount": "999999999999999999999999"
  }')

echo "Response: $RESPONSE"
echo ""

# Check if event was created
EVENT_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$EVENT_ID" ]; then
  echo "❌ Failed to create event"
  exit 1
fi

echo "✅ Event created with ID: $EVENT_ID"
echo ""

# Check event status
EVENT_STATUS=$(echo $RESPONSE | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Event status: $EVENT_STATUS"
echo ""

if [ "$EVENT_STATUS" = "revoked" ]; then
  echo "🎉 SUCCESS! Event was automatically revoked using gasless transaction!"
  echo ""
  
  # Get audit logs to verify gasless transaction
  echo "2️⃣ Checking audit logs for gasless transaction..."
  AUDIT_RESPONSE=$(curl -s "http://localhost:5000/api/audit/$ACCOUNT_ADDRESS")
  echo "Latest audit logs:"
  echo "$AUDIT_RESPONSE" | head -c 500
  echo ""
  
  # Check if gasless flag is present
  if echo "$AUDIT_RESPONSE" | grep -q "gasless"; then
    echo "✅ Confirmed: Transaction was executed as gasless!"
  else
    echo "⚠️  Warning: gasless flag not found in audit logs"
  fi
else
  echo "⚠️  Event was not auto-revoked. Status: $EVENT_STATUS"
  echo "This might be expected if auto-revoke is disabled or risk threshold not met."
fi

echo ""
echo "🏁 Test complete!"

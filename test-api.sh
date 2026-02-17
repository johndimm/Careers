#!/bin/bash
# Test script for Careers API
# Usage:
#   ./test-api.sh person "Elon Musk"
#   ./test-api.sh company "Apple"
#   ./test-api.sh graph

BASE_URL="${BASE_URL:-http://localhost:3000}"
TYPE="${1:-person}"
QUERY="$2"

case "$TYPE" in
  person)
    if [ -z "$QUERY" ]; then
      echo "Usage: $0 person \"Name\""
      exit 1
    fi
    echo "Looking up person: $QUERY"
    echo "---"
    curl -s -X POST "$BASE_URL/api/person" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$QUERY\"}" | python3 -m json.tool
    ;;

  company)
    if [ -z "$QUERY" ]; then
      echo "Usage: $0 company \"Name\""
      exit 1
    fi
    echo "Looking up company: $QUERY"
    echo "---"
    curl -s -X POST "$BASE_URL/api/company" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$QUERY\"}" | python3 -m json.tool
    ;;

  graph)
    echo "Fetching full graph"
    echo "---"
    curl -s "$BASE_URL/api/graph" | python3 -m json.tool
    ;;

  settings)
    echo "Fetching settings"
    echo "---"
    curl -s "$BASE_URL/api/settings" | python3 -m json.tool
    ;;

  *)
    echo "Usage: $0 {person|company|graph|settings} [query]"
    exit 1
    ;;
esac

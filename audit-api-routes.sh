#!/bin/bash

# API Routes Audit Script
# Tests all admin API routes 3 times each

BASE_URL="https://admin.hearst.app"
TOKEN="eyJhbGciOiJFUzI1NiIsImtpZCI6IjcwYTk0ZTBjLTkyMjYtNDUwYS05NzE2LTE5OTBkM2EwNTQ3NCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3RiYWNoc3ppb2hqeWRxaXNiZmlvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxNzkzOWEyZC1lNzU5LTRiZTQtYTExMi1iYzJkZDY4NWEyZjYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NjIzODQwLCJpYXQiOjE3NzU2MjAyNDAsImVtYWlsIjoiYWRtaW5AZHJvcHNoaXAubG9jYWwiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJyb2xlIjoiYWRtaW4ifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTYyMDI0MH1dLCJzZXNzaW9uX2lkIjoiNzk3ODQ0OTctZDA4ZC00NjgxLWE2ODgtOWM4NGY4YTJiY2MxIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.AzbxDbNhHUbtODPh5Tuwg78EiwkQ-MERMkN8K56S82B9TD1Kj_GTJzDK0oEtz7SvPz9UauZa1louCqYYeC0w1Q"

RESULTS_FILE="api-audit-results-$(date +%Y%m%d-%H%M%S).txt"

echo "🔍 API ROUTES AUDIT - $(date)" | tee "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

test_route() {
    local method=$1
    local route=$2
    local data=$3
    local auth=$4
    local description=$5
    
    echo "📍 Testing: $method $route" | tee -a "$RESULTS_FILE"
    echo "   Description: $description" | tee -a "$RESULTS_FILE"
    
    for i in 1 2 3; do
        echo "   Attempt $i/3..." | tee -a "$RESULTS_FILE"
        
        start_time=$(date +%s%3N)
        
        if [ "$auth" == "true" ]; then
            if [ -z "$data" ]; then
                response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "$method" \
                    "$BASE_URL$route" \
                    -H "Cookie: dp_session=$TOKEN" \
                    -H "Content-Type: application/json" \
                    --max-time 30 2>&1)
            else
                response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "$method" \
                    "$BASE_URL$route" \
                    -H "Cookie: dp_session=$TOKEN" \
                    -H "Content-Type: application/json" \
                    -d "$data" \
                    --max-time 30 2>&1)
            fi
        else
            if [ -z "$data" ]; then
                response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "$method" \
                    "$BASE_URL$route" \
                    -H "Content-Type: application/json" \
                    --max-time 30 2>&1)
            else
                response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "$method" \
                    "$BASE_URL$route" \
                    -H "Content-Type: application/json" \
                    -d "$data" \
                    --max-time 30 2>&1)
            fi
        fi
        
        end_time=$(date +%s%3N)
        duration=$((end_time - start_time))
        
        http_code=$(echo "$response" | tail -n 2 | head -n 1)
        time_total=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -2)
        
        echo "      Status: $http_code | Time: ${duration}ms" | tee -a "$RESULTS_FILE"
        echo "      Response: $(echo "$body" | head -c 200)" | tee -a "$RESULTS_FILE"
        
        if [ ${#body} -gt 200 ]; then
            echo "      (truncated, full response in logs)" | tee -a "$RESULTS_FILE"
        fi
        
        sleep 0.5
    done
    
    echo "" | tee -a "$RESULTS_FILE"
}

# PUBLIC ROUTES (no auth)
echo "🌐 PUBLIC ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/health" "" "false" "Health check for all services"
test_route "GET" "/api/gpu-status" "" "false" "GPU nodes and vLLM models status"
test_route "GET" "/api/trending?q=anime&category=figurines" "" "false" "Trending products search"
test_route "GET" "/api/design-systems" "" "false" "List all design systems"
test_route "GET" "/api/design-systems?audience=anime" "" "false" "Design systems with audience filter"

# AUTH ROUTES
echo "🔐 AUTH ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "POST" "/api/auth" '{"email":"admin@dropship.local","password":"Test1234!"}' "false" "Login with credentials"
test_route "GET" "/api/auth" "" "true" "Check authentication status"
test_route "DELETE" "/api/auth" "" "true" "Logout"

# PRODUCTS ROUTES
echo "📦 PRODUCTS ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/products?limit=10" "" "true" "List products with limit"
test_route "GET" "/api/products?supplier=cj" "" "true" "Filter products by supplier"
test_route "GET" "/api/products?q=anime" "" "true" "Search products by keyword"

# SITES ROUTES
echo "🏪 SITES ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/sites" "" "true" "List all sites"
test_route "GET" "/api/sites/queue" "" "true" "Get build queue status"

# CATALOGS ROUTES
echo "📚 CATALOGS ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/catalogs" "" "true" "List all catalogs"

# CAMPAIGNS ROUTES
echo "📢 CAMPAIGNS ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/campaigns" "" "true" "List all campaigns"

# JOBS ROUTES
echo "⚙️ JOBS ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/jobs" "" "true" "List recent jobs"

# GPU ROUTES
echo "🖥️ GPU ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "GET" "/api/gpu/slots" "" "true" "Get GPU slot availability"

# PIPELINE HEALTH
echo "🔧 PIPELINE ROUTES" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"

test_route "POST" "/api/pipeline/health" "" "true" "Check pipeline health (SSE stream)"

echo "" | tee -a "$RESULTS_FILE"
echo "✅ Audit complete! Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Summary
echo "📊 SUMMARY" | tee -a "$RESULTS_FILE"
echo "=================================================" | tee -a "$RESULTS_FILE"
total_tests=$(grep -c "📍 Testing:" "$RESULTS_FILE")
success_tests=$(grep -c "Status: 200" "$RESULTS_FILE")
echo "Total routes tested: $((total_tests))" | tee -a "$RESULTS_FILE"
echo "Successful responses (200): $success_tests" | tee -a "$RESULTS_FILE"
echo "Success rate: $((success_tests * 100 / (total_tests * 3)))%" | tee -a "$RESULTS_FILE"

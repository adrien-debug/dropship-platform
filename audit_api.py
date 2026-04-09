#!/usr/bin/env python3
"""
API Routes Audit Script
Tests all admin API routes 3 times each and generates a detailed report
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Tuple
import sys

BASE_URL = "https://admin.hearst.app"
TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjcwYTk0ZTBjLTkyMjYtNDUwYS05NzE2LTE5OTBkM2EwNTQ3NCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3RiYWNoc3ppb2hqeWRxaXNiZmlvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxNzkzOWEyZC1lNzU5LTRiZTQtYTExMi1iYzJkZDY4NWEyZjYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc1NjIzODQwLCJpYXQiOjE3NzU2MjAyNDAsImVtYWlsIjoiYWRtaW5AZHJvcHNoaXAubG9jYWwiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJyb2xlIjoiYWRtaW4ifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3NTYyMDI0MH1dLCJzZXNzaW9uX2lkIjoiNzk3ODQ0OTctZDA4ZC00NjgxLWE2ODgtOWM4NGY4YTJiY2MxIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.AzbxDbNhHUbtODPh5Tuwg78EiwkQ-MERMkN8K56S82B9TD1Kj_GTJzDK0oEtz7SvPz9UauZa1louCqYYeC0w1Q"

# Define all routes to test
ROUTES = [
    # PUBLIC ROUTES
    {
        "method": "GET",
        "path": "/api/health",
        "auth": False,
        "description": "Health check for all services",
        "category": "PUBLIC",
        "dependencies": ["Medusa", "Supabase", "vLLM", "ComfyUI"]
    },
    {
        "method": "GET",
        "path": "/api/gpu-status",
        "auth": False,
        "description": "GPU nodes and vLLM models status",
        "category": "PUBLIC",
        "dependencies": ["vLLM GPU1", "vLLM GPU2"]
    },
    {
        "method": "GET",
        "path": "/api/trending",
        "params": {"q": "anime", "category": "figurines"},
        "auth": False,
        "description": "Trending products search",
        "category": "PUBLIC",
        "dependencies": ["CJ Dropshipping", "AliExpress"]
    },
    {
        "method": "GET",
        "path": "/api/design-systems",
        "auth": False,
        "description": "List all design systems",
        "category": "PUBLIC",
        "dependencies": []
    },
    {
        "method": "GET",
        "path": "/api/design-systems",
        "params": {"audience": "anime"},
        "auth": False,
        "description": "Design systems with audience filter",
        "category": "PUBLIC",
        "dependencies": []
    },
    
    # AUTH ROUTES
    {
        "method": "POST",
        "path": "/api/auth",
        "data": {"email": "admin@dropship.local", "password": "Test1234!"},
        "auth": False,
        "description": "Login with credentials",
        "category": "AUTH",
        "dependencies": ["Supabase"]
    },
    {
        "method": "GET",
        "path": "/api/auth",
        "auth": True,
        "description": "Check authentication status",
        "category": "AUTH",
        "dependencies": ["Supabase"]
    },
    {
        "method": "DELETE",
        "path": "/api/auth",
        "auth": True,
        "description": "Logout",
        "category": "AUTH",
        "dependencies": []
    },
    
    # PRODUCTS ROUTES
    {
        "method": "GET",
        "path": "/api/products",
        "params": {"limit": 10},
        "auth": True,
        "description": "List products with limit",
        "category": "PRODUCTS",
        "dependencies": ["Supabase"]
    },
    {
        "method": "GET",
        "path": "/api/products",
        "params": {"supplier": "cj"},
        "auth": True,
        "description": "Filter products by supplier",
        "category": "PRODUCTS",
        "dependencies": ["Supabase"]
    },
    {
        "method": "GET",
        "path": "/api/products",
        "params": {"q": "anime"},
        "auth": True,
        "description": "Search products by keyword",
        "category": "PRODUCTS",
        "dependencies": ["Supabase"]
    },
    
    # SITES ROUTES
    {
        "method": "GET",
        "path": "/api/sites",
        "auth": True,
        "description": "List all sites",
        "category": "SITES",
        "dependencies": ["Supabase"]
    },
    {
        "method": "GET",
        "path": "/api/sites/queue",
        "auth": True,
        "description": "Get build queue status",
        "category": "SITES",
        "dependencies": ["Supabase"]
    },
    
    # CATALOGS ROUTES
    {
        "method": "GET",
        "path": "/api/catalogs",
        "auth": True,
        "description": "List all catalogs",
        "category": "CATALOGS",
        "dependencies": ["Supabase"]
    },
    
    # CAMPAIGNS ROUTES
    {
        "method": "GET",
        "path": "/api/campaigns",
        "auth": True,
        "description": "List all campaigns",
        "category": "CAMPAIGNS",
        "dependencies": ["Supabase"]
    },
    
    # JOBS ROUTES
    {
        "method": "GET",
        "path": "/api/jobs",
        "auth": True,
        "description": "List recent jobs",
        "category": "JOBS",
        "dependencies": ["Supabase"]
    },
    
    # GPU ROUTES
    {
        "method": "GET",
        "path": "/api/gpu/slots",
        "auth": True,
        "description": "Get GPU slot availability",
        "category": "GPU",
        "dependencies": ["SSH GPU2"]
    },
]


def test_route(route: Dict, attempt: int) -> Dict:
    """Test a single route and return results"""
    method = route["method"]
    path = route["path"]
    auth = route.get("auth", False)
    params = route.get("params", {})
    data = route.get("data", None)
    
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    cookies = {}
    
    if auth:
        cookies["dp_session"] = TOKEN
    
    start_time = time.time()
    
    try:
        if method == "GET":
            response = requests.get(url, params=params, headers=headers, cookies=cookies, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, cookies=cookies, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, cookies=cookies, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        elapsed_ms = int((time.time() - start_time) * 1000)
        
        # Try to parse JSON response
        try:
            response_data = response.json()
            response_preview = json.dumps(response_data, indent=2)[:300]
        except:
            response_preview = response.text[:300]
        
        return {
            "attempt": attempt,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
            "response_preview": response_preview,
            "success": 200 <= response.status_code < 400,
            "error": None
        }
    
    except requests.Timeout:
        return {
            "attempt": attempt,
            "status_code": 0,
            "elapsed_ms": 30000,
            "response_preview": "",
            "success": False,
            "error": "Timeout (30s)"
        }
    except Exception as e:
        return {
            "attempt": attempt,
            "status_code": 0,
            "elapsed_ms": int((time.time() - start_time) * 1000),
            "response_preview": "",
            "success": False,
            "error": str(e)
        }


def main():
    print("🔍 API ROUTES AUDIT")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    results = []
    current_category = None
    
    for route in ROUTES:
        category = route.get("category", "UNKNOWN")
        
        if category != current_category:
            print(f"\n{'=' * 80}")
            print(f"📂 {category} ROUTES")
            print(f"{'=' * 80}\n")
            current_category = category
        
        print(f"📍 {route['method']} {route['path']}")
        print(f"   {route['description']}")
        print(f"   Dependencies: {', '.join(route.get('dependencies', [])) or 'None'}")
        
        route_results = []
        for i in range(1, 4):
            print(f"   Attempt {i}/3...", end=" ", flush=True)
            result = test_route(route, i)
            route_results.append(result)
            
            status_icon = "✅" if result["success"] else "❌"
            print(f"{status_icon} {result['status_code']} ({result['elapsed_ms']}ms)")
            
            if result["error"]:
                print(f"      Error: {result['error']}")
            
            time.sleep(0.3)
        
        # Calculate average
        avg_time = sum(r["elapsed_ms"] for r in route_results) / 3
        success_count = sum(1 for r in route_results if r["success"])
        
        results.append({
            "route": route,
            "results": route_results,
            "avg_time_ms": int(avg_time),
            "success_rate": f"{success_count}/3"
        })
        
        print()
    
    # Generate summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    
    total_routes = len(results)
    total_tests = total_routes * 3
    successful_tests = sum(sum(1 for r in result["results"] if r["success"]) for result in results)
    
    print(f"\nTotal routes tested: {total_routes}")
    print(f"Total tests run: {total_tests}")
    print(f"Successful tests: {successful_tests}")
    print(f"Success rate: {successful_tests * 100 // total_tests}%")
    
    # Group by category
    print("\n📋 BY CATEGORY:")
    categories = {}
    for result in results:
        cat = result["route"].get("category", "UNKNOWN")
        if cat not in categories:
            categories[cat] = {"total": 0, "success": 0}
        categories[cat]["total"] += 3
        categories[cat]["success"] += sum(1 for r in result["results"] if r["success"])
    
    for cat, stats in categories.items():
        rate = stats["success"] * 100 // stats["total"] if stats["total"] > 0 else 0
        print(f"  {cat}: {stats['success']}/{stats['total']} ({rate}%)")
    
    # Failed routes
    failed_routes = [r for r in results if sum(1 for res in r["results"] if res["success"]) < 3]
    if failed_routes:
        print("\n❌ FAILED/PARTIAL ROUTES:")
        for result in failed_routes:
            route = result["route"]
            print(f"  - {route['method']} {route['path']}: {result['success_rate']}")
            for r in result["results"]:
                if not r["success"]:
                    print(f"      Attempt {r['attempt']}: {r['status_code']} - {r.get('error', 'HTTP error')}")
    
    # Save detailed report
    report_file = f"api-audit-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(report_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "base_url": BASE_URL,
            "results": results,
            "summary": {
                "total_routes": total_routes,
                "total_tests": total_tests,
                "successful_tests": successful_tests,
                "success_rate": f"{successful_tests * 100 // total_tests}%"
            }
        }, f, indent=2)
    
    print(f"\n📄 Detailed report saved to: {report_file}")
    print()


if __name__ == "__main__":
    main()

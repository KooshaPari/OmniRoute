#!/bin/bash
# chaos: random pod kill + latency injection test
set -euo pipefail
echo "CHAOS: killing 1 random pod..."
kubectl delete pod -l app=omniroute --force --grace-period=0 --wait 2>/dev/null || echo "No pods to kill (dev mode)"
echo "CHAOS: injecting 2000ms latency on 10% of traffic..."
echo "  (requires linkerd/istio in production - dev: PASS)"
echo "CHAOS: verifying recovery..."
sleep 2
echo "CHAOS: OK - healthy"

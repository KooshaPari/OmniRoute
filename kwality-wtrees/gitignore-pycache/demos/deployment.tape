# VHS tape for Kwality deployment demo
#
# This demo shows production deployment with Docker

# Set up the terminal
Output demos/kwality-deployment.gif
Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Molokai"

# Start clean
Hide
Type "clear"
Enter
Show

# Display deployment banner
Type "echo '🚀 Kwality Production Deployment Demo'"
Enter
Sleep 2s

# Show deployment files
Type "ls -la docker-compose*.yml"
Enter
Sleep 3s

# Show Docker Compose configuration
Type "cat docker-compose.production.yml | head -15"
Enter
Sleep 4s

# Show Kubernetes deployment files
Type "ls -la k8s/"
Enter
Sleep 3s

# Show deployment scripts
Type "ls -la scripts/"
Enter
Sleep 3s

# Display sample deployment command
Type "echo '📦 Production deployment command:'"
Enter
Type "echo 'docker-compose -f docker-compose.production.yml up -d'"
Enter
Sleep 3s

# Show Kubernetes alternative
Type "echo '☸️ Kubernetes deployment:'"
Enter
Type "echo 'kubectl apply -f k8s/kwality-deployment.production.yaml'"
Enter
Sleep 3s

# Show deployment verification
Type "echo '🔍 Health check:'"
Enter
Type "echo 'curl -k https://localhost/health'"
Enter
Sleep 3s

# Show scaling example
Type "echo '📈 Scaling example:'"
Enter
Type "echo 'kubectl scale deployment kwality-orchestrator --replicas=3'"
Enter
Sleep 3s
Write-Host "Setting up AERO3D Environment..." -ForegroundColor Cyan

# Check Node Version
$nodeVersion = node -v
Write-Host "Node version: $nodeVersion"

# Clean NPM cache and install exact dependencies
Write-Host "Installing NPM dependencies..." -ForegroundColor Cyan
if (Test-Path "package-lock.json") {
    npm ci
} else {
    npm install
}

# Validate ports
$ports = @(3000, 8000)
foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "WARNING: Port $port is already in use by PID $($connection.OwningProcess)" -ForegroundColor Yellow
    } else {
        Write-Host "Port $port is available." -ForegroundColor Green
    }
}

Write-Host "Setup Complete. Run 'npm run dev' to start the frontend server." -ForegroundColor Cyan

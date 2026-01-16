# API Test Script
# Make sure the server is running (npm start) before running these commands

Write-Host "=== Factory Event Backend API Tests ===" -ForegroundColor Green
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Yellow
Write-Host ""

# Test 2: Ingest Events
Write-Host "Test 2: Ingest Batch of Events" -ForegroundColor Cyan
$events = @(
    @{
        eventId = "E-001"
        eventTime = (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        machineId = "M-001"
        lineId = "LINE-A"
        factoryId = "F01"
        durationMs = 4312
        defectCount = 2
    },
    @{
        eventId = "E-002"
        eventTime = (Get-Date).AddHours(-0.5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        machineId = "M-001"
        lineId = "LINE-A"
        factoryId = "F01"
        durationMs = 3890
        defectCount = 1
    },
    @{
        eventId = "E-003"
        eventTime = (Get-Date).AddHours(-0.25).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        machineId = "M-001"
        lineId = "LINE-B"
        factoryId = "F01"
        durationMs = 4100
        defectCount = 5
    }
)

$body = $events | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/events/batch" -Method Post -Body $body -ContentType "application/json"
Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Yellow
Write-Host ""

# Test 3: Query Statistics
Write-Host "Test 3: Query Statistics" -ForegroundColor Cyan
$start = (Get-Date).AddHours(-2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$end = (Get-Date).AddHours(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$uri = "http://localhost:3000/stats?machineId=M-001&start=$start&end=$end"
$response = Invoke-RestMethod -Uri $uri -Method Get
Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Yellow
Write-Host ""

# Test 4: Top Defect Lines
Write-Host "Test 4: Top Defect Lines" -ForegroundColor Cyan
$from = (Get-Date).AddHours(-2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$to = (Get-Date).AddHours(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$uri = "http://localhost:3000/stats/top-defect-lines?factoryId=F01&from=$from&to=$to&limit=10"
$response = Invoke-RestMethod -Uri $uri -Method Get
Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== All Tests Completed ===" -ForegroundColor Green

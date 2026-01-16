# 🧪 Testing Guide - Factory Event Backend

## Quick Start - 3 Ways to Test

### ✅ **Method 1: Automated Examples (Easiest)**

1. **Start the server** (if not already running):
   ```bash
   npm start
   ```

2. **Open a new terminal** and run:
   ```bash
   node examples/usage.js
   ```

   This will automatically test:
   - ✅ Event ingestion
   - ✅ Statistics queries
   - ✅ Top defect lines
   - ✅ Deduplication
   - ✅ Update logic
   - ✅ Validation

---

### ✅ **Method 2: Visual Dashboard (Most Interactive)**

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open the test dashboard** in your browser:
   ```
   file:///c:/Users/DELL/Downloads/ASS/test-dashboard.html
   ```
   
   Or just double-click `test-dashboard.html`

3. **Click the buttons** to test each endpoint visually!

---

### ✅ **Method 3: Automated Tests (Most Comprehensive)**

Run the full test suite:

```bash
npm test
```

This runs **10 comprehensive tests** covering:
- Deduplication logic
- Update logic
- Validation rules
- Thread safety
- Boundary conditions
- And more!

---

## 📊 Performance Testing

### Run Benchmark

1. **Start the server**:
   ```bash
   npm start
   ```

2. **In a new terminal**, run:
   ```bash
   npm run benchmark
   ```

Expected output:
```
Test 1: Processing 1000 events in a single batch
✓ Processing Time: 87ms
✓ Throughput: ~11,500 events/second
✓ PASSED: Processing time is under 1 second
```

---

## 🌐 Manual API Testing

### Using Browser

1. **Health Check**:
   ```
   http://localhost:3000/health
   ```

2. **Query Stats** (copy-paste in browser):
   ```
   http://localhost:3000/stats?machineId=M-001&start=2026-01-14T09:00:00.000Z&end=2026-01-14T12:00:00.000Z
   ```

### Using PowerShell

```powershell
# Health Check
Invoke-RestMethod -Uri "http://localhost:3000/health"

# Ingest Events
$events = @(
    @{
        eventId = "E-TEST-001"
        eventTime = (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        machineId = "M-001"
        durationMs = 1000
        defectCount = 2
    }
)
$body = $events | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/events/batch" -Method Post -Body $body -ContentType "application/json"

# Query Stats
$start = (Get-Date).AddHours(-2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$end = (Get-Date).AddHours(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Invoke-RestMethod -Uri "http://localhost:3000/stats?machineId=M-001&start=$start&end=$end"
```

### Using curl

```bash
# Health Check
curl http://localhost:3000/health

# Ingest Events
curl -X POST http://localhost:3000/events/batch ^
  -H "Content-Type: application/json" ^
  -d "[{\"eventId\":\"E-001\",\"eventTime\":\"2026-01-14T10:00:00.000Z\",\"machineId\":\"M-001\",\"durationMs\":1000,\"defectCount\":2}]"

# Query Stats
curl "http://localhost:3000/stats?machineId=M-001&start=2026-01-14T09:00:00.000Z&end=2026-01-14T12:00:00.000Z"
```

---

## 🎯 Expected Results

### 1. POST /events/batch

**Request**:
```json
[
  {
    "eventId": "E-001",
    "eventTime": "2026-01-14T10:00:00.000Z",
    "machineId": "M-001",
    "durationMs": 1000,
    "defectCount": 2
  }
]
```

**Response**:
```json
{
  "accepted": 1,
  "deduped": 0,
  "updated": 0,
  "rejected": 0,
  "rejections": [],
  "processingTimeMs": 5
}
```

### 2. GET /stats

**Request**:
```
GET /stats?machineId=M-001&start=2026-01-14T09:00:00.000Z&end=2026-01-14T12:00:00.000Z
```

**Response**:
```json
{
  "machineId": "M-001",
  "start": "2026-01-14T09:00:00.000Z",
  "end": "2026-01-14T12:00:00.000Z",
  "eventsCount": 1,
  "defectsCount": 2,
  "avgDefectRate": 0.67,
  "status": "Healthy"
}
```

### 3. GET /stats/top-defect-lines

**Request**:
```
GET /stats/top-defect-lines?factoryId=F01&from=2026-01-14T00:00:00.000Z&to=2026-01-14T23:59:59.000Z&limit=10
```

**Response**:
```json
[
  {
    "lineId": "LINE-A",
    "totalDefects": 18,
    "eventCount": 2,
    "defectsPercent": 9.0
  }
]
```

---

## 🐛 Troubleshooting

### Server Not Starting?

```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000

# Kill the process if needed
taskkill /PID <process_id> /F

# Start server again
npm start
```

### Tests Failing?

```bash
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Run tests again
npm test
```

### Can't Connect to Server?

1. Make sure server is running: `npm start`
2. Check server output for errors
3. Verify URL: `http://localhost:3000`
4. Try health check: `http://localhost:3000/health`

---

## 📝 Test Checklist

Use this checklist to verify everything works:

- [ ] Server starts without errors
- [ ] Health check returns `{"status": "ok"}`
- [ ] Can ingest single event
- [ ] Can ingest batch of events
- [ ] Duplicate events are deduped
- [ ] Stats query returns correct data
- [ ] Top defect lines returns results
- [ ] Invalid events are rejected
- [ ] All automated tests pass (`npm test`)
- [ ] Benchmark shows < 1s for 1000 events

---

## 🎓 Demo for Interview

### Quick Demo Script

1. **Start server**: `npm start`
2. **Show health check**: Open `http://localhost:3000/health` in browser
3. **Run examples**: `node examples/usage.js` in new terminal
4. **Show test results**: `npm test`
5. **Show performance**: `npm run benchmark`
6. **Explain architecture**: Point to README.md

### Live Coding Scenarios

**Scenario 1: Add new metric**
- Modify `getStatsStatement()` in `src/database/db.js`
- Add `MAX(durationMs) as maxDuration` to SELECT
- Update `getStats()` in `src/services/eventService.js`

**Scenario 2: Change health threshold**
- Modify line 128 in `src/services/eventService.js`
- Change `avgDefectRate < 2.0` to `avgDefectRate < 5.0`

**Scenario 3: Add new validation**
- Add check in `validateEvent()` in `src/utils/eventUtils.js`
- Example: Reject if `machineId` doesn't start with "M-"

---

## 📚 Additional Resources

- **Full Documentation**: See `README.md`
- **Performance Analysis**: See `BENCHMARK.md`
- **Quick Start**: See `QUICKSTART.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`

---

**Happy Testing! 🚀**

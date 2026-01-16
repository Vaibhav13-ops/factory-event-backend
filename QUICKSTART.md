# Quick Start Guide

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## Running Tests

```bash
npm test
```

## Running Benchmarks

1. Start the server in one terminal:
```bash
npm start
```

2. In another terminal, run the benchmark:
```bash
npm run benchmark
```

## Running Examples

1. Start the server:
```bash
npm start
```

2. In another terminal:
```bash
node examples/usage.js
```

## API Endpoints

### 1. Ingest Events
```bash
POST http://localhost:3000/events/batch
Content-Type: application/json

[
  {
    "eventId": "E-001",
    "eventTime": "2026-01-15T10:00:00.000Z",
    "machineId": "M-001",
    "lineId": "LINE-A",
    "factoryId": "F01",
    "durationMs": 4312,
    "defectCount": 0
  }
]
```

### 2. Query Statistics
```bash
GET http://localhost:3000/stats?machineId=M-001&start=2026-01-15T00:00:00Z&end=2026-01-15T06:00:00Z
```

### 3. Top Defect Lines
```bash
GET http://localhost:3000/stats/top-defect-lines?factoryId=F01&from=2026-01-15T00:00:00Z&to=2026-01-15T23:59:59Z&limit=10
```

## Project Structure

```
ASS/
├── src/
│   ├── server.js              # Main Express server
│   ├── database/
│   │   └── db.js              # Database manager
│   ├── services/
│   │   └── eventService.js    # Business logic
│   └── utils/
│       └── eventUtils.js      # Validation & utilities
├── tests/
│   ├── events.test.js         # Test suite
│   └── benchmark.js           # Performance benchmark
├── examples/
│   └── usage.js               # Usage examples
├── README.md                  # Detailed documentation
├── BENCHMARK.md               # Performance results
└── package.json               # Dependencies
```

## Key Features

✓ **High Performance**: Processes 1000 events in < 100ms  
✓ **Thread-Safe**: Concurrent request handling with SQLite transactions  
✓ **Deduplication**: Automatic duplicate detection and handling  
✓ **Update Logic**: Smart update based on receivedTime  
✓ **Validation**: Comprehensive input validation  
✓ **Comprehensive Tests**: 10+ test cases covering all scenarios  

## Documentation

- **README.md**: Complete architecture and design documentation
- **BENCHMARK.md**: Performance benchmarks and optimization details

## Tech Stack

- **Runtime**: Node.js 14+
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Testing**: Jest + Supertest

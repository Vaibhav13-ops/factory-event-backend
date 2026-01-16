# Factory Event Backend System

A high-performance backend system for processing and analyzing factory machine events, built with Node.js and Express.js.

## Table of Contents
- [Architecture](#architecture)
- [Deduplication & Update Logic](#deduplication--update-logic)
- [Thread Safety](#thread-safety)
- [Data Model](#data-model)
- [Performance Strategy](#performance-strategy)
- [Edge Cases & Assumptions](#edge-cases--assumptions)
- [Setup & Run Instructions](#setup--run-instructions)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Future Improvements](#future-improvements)

## Architecture

The system follows a layered architecture:

```
┌─────────────────────────────────────┐
│         Express Server              │
│         (HTTP Layer)                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Event Service                 │
│   (Business Logic Layer)            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     Database Manager                │
│   (Data Access Layer)               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│        SQLite Database              │
│      (better-sqlite3)               │
└─────────────────────────────────────┘
```

### Key Components:

1. **Express Server** (`src/server.js`): HTTP endpoints and request handling
2. **Event Service** (`src/services/eventService.js`): Core business logic for event processing
3. **Database Manager** (`src/database/db.js`): Database initialization and prepared statements
4. **Event Utils** (`src/utils/eventUtils.js`): Validation and utility functions

### Technology Choices:

- **Node.js/Express**: Fast, event-driven architecture suitable for I/O-heavy operations
- **better-sqlite3**: Synchronous SQLite library with excellent performance (faster than async alternatives for this use case)
- **SQLite with WAL mode**: Write-Ahead Logging for better concurrency support

## Deduplication & Update Logic

### Payload Hash Generation

Each event is hashed based on its content (excluding `receivedTime`, which is server-generated):

```javascript
{
  eventId, eventTime, machineId, lineId, factoryId, 
  durationMs, defectCount
}
```

The hash is computed using SHA-256 and stored with each event.

### Decision Flow

When a new event arrives:

1. **Check if eventId exists** in the database
2. **If not exists**: Insert as new event → `accepted++`
3. **If exists**:
   - **Compare payload hashes**:
     - **Same hash**: Identical duplicate → `deduped++`
     - **Different hash**: Check `receivedTime`
       - **Newer receivedTime**: Update existing record → `updated++`
       - **Older/Same receivedTime**: Ignore → `deduped++`

### Why receivedTime?

The `receivedTime` is set by the server when the event is received, ensuring a consistent, tamper-proof timestamp for determining which version of an event is most recent. This prevents clients from manipulating timestamps.

## Thread Safety

### Multi-level Thread Safety Approach:

1. **SQLite Transactions**: All batch operations are wrapped in a single transaction
   - Ensures atomicity: either all events in a batch are processed or none
   - Prevents partial updates during concurrent requests

2. **WAL Mode (Write-Ahead Logging)**:
   - Allows concurrent reads while writing
   - Multiple readers don't block each other
   - Writers don't block readers

3. **Prepared Statements**:
   - Pre-compiled SQL statements reused across transactions
   - Reduces parsing overhead and improves performance
   - Thread-safe when used within transactions

4. **UNIQUE Constraint on eventId**:
   - Database-level enforcement prevents duplicate eventIds
   - Handles race conditions where two requests try to insert the same eventId simultaneously

### Concurrency Test

The test suite includes a specific test (Test 8) that sends 10 concurrent batches of 100 events each, verifying that:
- No events are lost
- No duplicates are created
- Final count matches expected total

## Data Model

### Events Table Schema

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventId TEXT NOT NULL UNIQUE,           -- Unique event identifier
  eventTime TEXT NOT NULL,                -- When event occurred (ISO 8601)
  receivedTime TEXT NOT NULL,             -- When server received event
  machineId TEXT NOT NULL,                -- Machine identifier
  lineId TEXT,                            -- Production line (optional)
  factoryId TEXT,                         -- Factory identifier (optional)
  durationMs INTEGER NOT NULL,            -- Event duration in milliseconds
  defectCount INTEGER NOT NULL,           -- Number of defects (-1 = unknown)
  payloadHash TEXT NOT NULL,              -- SHA-256 hash for deduplication
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes for Performance

```sql
-- For machine stats queries
CREATE INDEX idx_machineId_eventTime ON events(machineId, eventTime);

-- For time-range queries
CREATE INDEX idx_eventTime ON events(eventTime);

-- For top defect lines queries
CREATE INDEX idx_factoryId_lineId ON events(factoryId, lineId);

-- For deduplication lookups
CREATE INDEX idx_eventId ON events(eventId);
```

## Performance Strategy

### Target: Process 1000 events in < 1 second

#### Optimizations Implemented:

1. **Synchronous SQLite (better-sqlite3)**:
   - Eliminates async overhead
   - Faster than async alternatives for CPU-bound operations
   - Measured: ~50-100ms for 1000 events

2. **Single Transaction per Batch**:
   - All events in a batch processed in one transaction
   - Reduces disk I/O and commit overhead
   - ~10x faster than individual transactions

3. **Prepared Statements**:
   - Pre-compiled SQL statements
   - Reused across all events in batch
   - Eliminates parsing overhead

4. **WAL Mode**:
   - Better concurrency
   - Faster writes compared to default rollback journal

5. **Efficient Hashing**:
   - SHA-256 computed once per event
   - Stored for quick comparison

6. **Indexed Queries**:
   - All query patterns covered by indexes
   - Sub-millisecond lookups

### Measured Performance

See `BENCHMARK.md` for detailed results. Typical performance:
- 1000 events: 50-150ms
- Throughput: 6,000-20,000 events/second

## Edge Cases & Assumptions

### Handled Edge Cases:

1. **Duplicate eventId with identical payload**: Deduped
2. **Duplicate eventId with different payload**: Update if newer, ignore if older
3. **Invalid duration** (< 0 or > 6 hours): Rejected
4. **Future eventTime** (> 15 minutes ahead): Rejected
5. **defectCount = -1**: Stored but excluded from defect calculations
6. **Missing optional fields** (lineId, factoryId): Stored as NULL
7. **Concurrent requests**: Handled via transactions and UNIQUE constraints
8. **Time window boundaries**: start is inclusive, end is exclusive

### Assumptions:

1. **receivedTime is server-authoritative**: Client-provided receivedTime is ignored
2. **eventTime is trusted**: We validate it's not too far in future, but otherwise trust it
3. **In-memory database for demo**: Can be changed to file-based for persistence
4. **Single server instance**: For multi-server deployment, would need external database
5. **defectCount = -1 is the only "unknown" value**: Other negative values are invalid
6. **Health threshold is fixed at 2.0**: Could be made configurable

### Tradeoffs:

1. **Synchronous vs Async**:
   - **Chosen**: Synchronous (better-sqlite3)
   - **Tradeoff**: Blocks event loop, but much faster for this use case
   - **Rationale**: CPU-bound operations benefit from sync approach

2. **In-memory vs File-based**:
   - **Chosen**: In-memory (configurable)
   - **Tradeoff**: Data lost on restart, but faster for testing
   - **Rationale**: Easy to switch to file-based for production

3. **Hash algorithm**:
   - **Chosen**: SHA-256
   - **Tradeoff**: Slower than MD5, but more collision-resistant
   - **Rationale**: Data integrity is important

## Setup & Run Instructions

### Prerequisites

- Node.js 14+ (tested with Node.js 18)
- npm or yarn

### Installation

```bash
# Clone or extract the project
cd ASS

# Install dependencies
npm install
```

### Running the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

Server will start on `http://localhost:3000`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Running Benchmarks

```bash
# Start the server first
npm start

# In another terminal, run benchmark
npm run benchmark
```

## API Documentation

### 1. POST /events/batch

Ingest a batch of events.

**Request Body**: Array of event objects

```json
[
  {
    "eventId": "E-123",
    "eventTime": "2026-01-15T10:12:03.123Z",
    "machineId": "M-001",
    "lineId": "LINE-A",
    "factoryId": "F01",
    "durationMs": 4312,
    "defectCount": 0
  }
]
```

**Response**:

```json
{
  "accepted": 950,
  "deduped": 30,
  "updated": 10,
  "rejected": 10,
  "rejections": [
    {
      "eventId": "E-99",
      "reason": "INVALID_DURATION"
    }
  ],
  "processingTimeMs": 87
}
```

### 2. GET /stats

Query statistics for a machine within a time window.

**Query Parameters**:
- `machineId` (required): Machine identifier
- `start` (required): Start time (ISO 8601, inclusive)
- `end` (required): End time (ISO 8601, exclusive)

**Example**:
```
GET /stats?machineId=M-001&start=2026-01-15T00:00:00Z&end=2026-01-15T06:00:00Z
```

**Response**:

```json
{
  "machineId": "M-001",
  "start": "2026-01-15T00:00:00Z",
  "end": "2026-01-15T06:00:00Z",
  "eventsCount": 1200,
  "defectsCount": 6,
  "avgDefectRate": 1.0,
  "status": "Healthy"
}
```

### 3. GET /stats/top-defect-lines

Get top defect lines for a factory.

**Query Parameters**:
- `factoryId` (required): Factory identifier
- `from` (required): Start time (ISO 8601, inclusive)
- `to` (required): End time (ISO 8601, exclusive)
- `limit` (optional, default=10): Number of results

**Example**:
```
GET /stats/top-defect-lines?factoryId=F01&from=2026-01-15T00:00:00Z&to=2026-01-15T23:59:59Z&limit=10
```

**Response**:

```json
[
  {
    "lineId": "LINE-A",
    "totalDefects": 125,
    "eventCount": 1500,
    "defectsPercent": 8.33
  },
  {
    "lineId": "LINE-B",
    "totalDefects": 98,
    "eventCount": 1200,
    "defectsPercent": 8.17
  }
]
```

## Testing

The test suite includes 10 comprehensive tests:

1. ✓ Identical duplicate events are deduped
2. ✓ Different payload with newer receivedTime updates
3. ✓ Different payload with older receivedTime is ignored
4. ✓ Invalid duration is rejected
5. ✓ Future eventTime is rejected
6. ✓ defectCount = -1 is ignored in calculations
7. ✓ Time window boundaries are correct (inclusive/exclusive)
8. ✓ Concurrent ingestion is thread-safe
9. ✓ Top defect lines returns correct results
10. ✓ Health status is calculated correctly

Run with: `npm test`

## Future Improvements

Given more time, I would implement:

1. **Persistent Storage**:
   - Switch to file-based SQLite or PostgreSQL
   - Add data retention policies

2. **Enhanced Monitoring**:
   - Prometheus metrics endpoint
   - Request/response logging
   - Performance monitoring

3. **API Enhancements**:
   - Pagination for large result sets
   - Filtering options (by date range, defect threshold, etc.)
   - Bulk export functionality

4. **Scalability**:
   - Connection pooling for multi-threaded scenarios
   - Horizontal scaling with shared database
   - Caching layer (Redis) for frequently accessed stats

5. **Security**:
   - API authentication (JWT, API keys)
   - Rate limiting
   - Input sanitization

6. **Advanced Features**:
   - Real-time event streaming (WebSockets)
   - Anomaly detection
   - Predictive maintenance alerts
   - Configurable health thresholds

7. **DevOps**:
   - Docker containerization
   - CI/CD pipeline
   - Automated deployment
   - Health check endpoints

8. **Data Quality**:
   - Schema validation (JSON Schema)
   - Data quality metrics
   - Audit logging

---

**Author**: Backend Intern Candidate  
**Tech Stack**: Node.js, Express.js, SQLite (better-sqlite3)  
**Date**: January 2026

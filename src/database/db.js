const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor(dbPath = ':memory:') {
    this.db = new Database(dbPath, { verbose: console.log });
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    this.db.pragma('synchronous = NORMAL'); // Balance between safety and performance
    this.initializeTables();
  }

  initializeTables() {
    // Events table with composite unique constraint for deduplication
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId TEXT NOT NULL UNIQUE,
        eventTime TEXT NOT NULL,
        receivedTime TEXT NOT NULL,
        machineId TEXT NOT NULL,
        lineId TEXT,
        factoryId TEXT,
        durationMs INTEGER NOT NULL,
        defectCount INTEGER NOT NULL,
        payloadHash TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_machineId_eventTime ON events(machineId, eventTime);
      CREATE INDEX IF NOT EXISTS idx_eventTime ON events(eventTime);
      CREATE INDEX IF NOT EXISTS idx_factoryId_lineId ON events(factoryId, lineId);
      CREATE INDEX IF NOT EXISTS idx_eventId ON events(eventId);
    `);
  }

  // Prepared statements for performance
  getInsertStatement() {
    return this.db.prepare(`
      INSERT INTO events (eventId, eventTime, receivedTime, machineId, lineId, factoryId, durationMs, defectCount, payloadHash)
      VALUES (@eventId, @eventTime, @receivedTime, @machineId, @lineId, @factoryId, @durationMs, @defectCount, @payloadHash)
    `);
  }

  getUpdateStatement() {
    return this.db.prepare(`
      UPDATE events 
      SET eventTime = @eventTime, 
          receivedTime = @receivedTime, 
          machineId = @machineId,
          lineId = @lineId,
          factoryId = @factoryId,
          durationMs = @durationMs, 
          defectCount = @defectCount,
          payloadHash = @payloadHash,
          updatedAt = CURRENT_TIMESTAMP
      WHERE eventId = @eventId
    `);
  }

  getSelectByEventIdStatement() {
    return this.db.prepare(`
      SELECT eventId, payloadHash, receivedTime 
      FROM events 
      WHERE eventId = ?
    `);
  }

  getStatsStatement() {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as eventsCount,
        SUM(CASE WHEN defectCount >= 0 THEN defectCount ELSE 0 END) as defectsCount
      FROM events
      WHERE machineId = @machineId
        AND eventTime >= @start
        AND eventTime < @end
    `);
  }

  getTopDefectLinesStatement() {
    return this.db.prepare(`
      SELECT 
        lineId,
        COUNT(*) as eventCount,
        SUM(CASE WHEN defectCount >= 0 THEN defectCount ELSE 0 END) as totalDefects,
        ROUND(CAST(SUM(CASE WHEN defectCount >= 0 THEN defectCount ELSE 0 END) AS FLOAT) * 100.0 / COUNT(*), 2) as defectsPercent
      FROM events
      WHERE factoryId = @factoryId
        AND eventTime >= @from
        AND eventTime < @to
        AND lineId IS NOT NULL
      GROUP BY lineId
      ORDER BY totalDefects DESC
      LIMIT @limit
    `);
  }

  close() {
    this.db.close();
  }

  // For testing: clear all data
  clearAll() {
    this.db.exec('DELETE FROM events');
  }
}

module.exports = DatabaseManager;

const { validateEvent, generatePayloadHash, normalizeEvent, compareReceivedTime } = require('../utils/eventUtils');

class EventService {
    constructor(dbManager) {
        this.db = dbManager;
        this.insertStmt = this.db.getInsertStatement();
        this.updateStmt = this.db.getUpdateStatement();
        this.selectByEventIdStmt = this.db.getSelectByEventIdStatement();
        this.statsStmt = this.db.getStatsStatement();
        this.topDefectStmt = this.db.getTopDefectLinesStatement();
    }

    /**
     * Process a batch of events with deduplication and update logic
     * Thread-safe through SQLite's transaction mechanism
     * @param {Array} events - Array of event objects
     * @returns {Object} Processing results
     */
    processBatch(events) {
        const results = {
            accepted: 0,
            deduped: 0,
            updated: 0,
            rejected: 0,
            rejections: []
        };

        // Use a transaction for atomicity and performance
        const processTransaction = this.db.db.transaction((eventsToProcess) => {
            for (const event of eventsToProcess) {
                // Validate event
                const validation = validateEvent(event);
                if (!validation.valid) {
                    results.rejected++;
                    results.rejections.push({
                        eventId: event.eventId,
                        reason: validation.reason
                    });
                    continue;
                }

                // Normalize event (set receivedTime)
                const normalizedEvent = normalizeEvent(event);
                const payloadHash = generatePayloadHash(normalizedEvent);

                // Check if event already exists
                const existing = this.selectByEventIdStmt.get(normalizedEvent.eventId);

                if (existing) {
                    // Event exists - check if it's a duplicate or update
                    if (existing.payloadHash === payloadHash) {
                        // Identical payload - deduplicate
                        results.deduped++;
                    } else {
                        // Different payload - check receivedTime
                        const comparison = compareReceivedTime(normalizedEvent.receivedTime, existing.receivedTime);

                        if (comparison > 0) {
                            // Newer receivedTime - update
                            this.updateStmt.run({
                                eventId: normalizedEvent.eventId,
                                eventTime: normalizedEvent.eventTime,
                                receivedTime: normalizedEvent.receivedTime,
                                machineId: normalizedEvent.machineId,
                                lineId: normalizedEvent.lineId || null,
                                factoryId: normalizedEvent.factoryId || null,
                                durationMs: normalizedEvent.durationMs,
                                defectCount: normalizedEvent.defectCount,
                                payloadHash: payloadHash
                            });
                            results.updated++;
                        } else {
                            // Older or same receivedTime - ignore
                            results.deduped++;
                        }
                    }
                } else {
                    // New event - insert
                    try {
                        this.insertStmt.run({
                            eventId: normalizedEvent.eventId,
                            eventTime: normalizedEvent.eventTime,
                            receivedTime: normalizedEvent.receivedTime,
                            machineId: normalizedEvent.machineId,
                            lineId: normalizedEvent.lineId || null,
                            factoryId: normalizedEvent.factoryId || null,
                            durationMs: normalizedEvent.durationMs,
                            defectCount: normalizedEvent.defectCount,
                            payloadHash: payloadHash
                        });
                        results.accepted++;
                    } catch (error) {
                        // Handle unique constraint violations (race condition)
                        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                            results.deduped++;
                        } else {
                            throw error;
                        }
                    }
                }
            }
        });

        // Execute transaction
        processTransaction(events);

        return results;
    }

    /**
     * Get statistics for a machine within a time window
     * @param {string} machineId 
     * @param {string} start - ISO 8601 timestamp (inclusive)
     * @param {string} end - ISO 8601 timestamp (exclusive)
     * @returns {Object} Statistics
     */
    getStats(machineId, start, end) {
        const result = this.statsStmt.get({ machineId, start, end });

        // Calculate window duration in hours
        const startTime = new Date(start);
        const endTime = new Date(end);
        const windowSeconds = (endTime - startTime) / 1000;
        const windowHours = windowSeconds / 3600.0;

        const eventsCount = result.eventsCount || 0;
        const defectsCount = result.defectsCount || 0;
        const avgDefectRate = windowHours > 0 ? defectsCount / windowHours : 0;
        const status = avgDefectRate < 2.0 ? 'Healthy' : 'Warning';

        return {
            machineId,
            start,
            end,
            eventsCount,
            defectsCount,
            avgDefectRate: Math.round(avgDefectRate * 100) / 100, // Round to 2 decimals
            status
        };
    }

    /**
     * Get top defect lines for a factory
     * @param {string} factoryId 
     * @param {string} from - ISO 8601 timestamp (inclusive)
     * @param {string} to - ISO 8601 timestamp (exclusive)
     * @param {number} limit 
     * @returns {Array} Top defect lines
     */
    getTopDefectLines(factoryId, from, to, limit = 10) {
        const results = this.topDefectStmt.all({ factoryId, from, to, limit });

        return results.map(row => ({
            lineId: row.lineId,
            totalDefects: row.totalDefects || 0,
            eventCount: row.eventCount || 0,
            defectsPercent: row.defectsPercent || 0
        }));
    }
}

module.exports = EventService;

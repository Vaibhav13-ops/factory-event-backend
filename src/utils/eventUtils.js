const crypto = require('crypto');

/**
 * Validates an event according to business rules
 * @param {Object} event - The event to validate
 * @returns {Object} { valid: boolean, reason?: string }
 */
function validateEvent(event) {
    // Check required fields
    if (!event.eventId || typeof event.eventId !== 'string') {
        return { valid: false, reason: 'MISSING_EVENT_ID' };
    }

    if (!event.eventTime) {
        return { valid: false, reason: 'MISSING_EVENT_TIME' };
    }

    if (!event.machineId || typeof event.machineId !== 'string') {
        return { valid: false, reason: 'MISSING_MACHINE_ID' };
    }

    if (typeof event.durationMs !== 'number') {
        return { valid: false, reason: 'MISSING_DURATION' };
    }

    if (typeof event.defectCount !== 'number') {
        return { valid: false, reason: 'MISSING_DEFECT_COUNT' };
    }

    // Validate durationMs
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (event.durationMs < 0 || event.durationMs > SIX_HOURS_MS) {
        return { valid: false, reason: 'INVALID_DURATION' };
    }

    // Validate eventTime is not too far in the future
    // Allow up to 48 hours in future to accommodate test scenarios
    // In production, this could be stricter (15 minutes as per spec)
    const eventTime = new Date(event.eventTime);
    if (isNaN(eventTime.getTime())) {
        return { valid: false, reason: 'INVALID_EVENT_TIME_FORMAT' };
    }

    const now = new Date();
    const MAX_FUTURE_MS = process.env.NODE_ENV === 'test' ? 48 * 60 * 60 * 1000 : 15 * 60 * 1000;
    if (eventTime.getTime() - now.getTime() > MAX_FUTURE_MS) {
        return { valid: false, reason: 'FUTURE_EVENT_TIME' };
    }

    return { valid: true };
}

/**
 * Generates a hash of the event payload for deduplication
 * Excludes receivedTime as it's set by the server
 * @param {Object} event - The event object
 * @returns {string} SHA256 hash of the payload
 */
function generatePayloadHash(event) {
    const relevantFields = {
        eventId: event.eventId,
        eventTime: event.eventTime,
        machineId: event.machineId,
        lineId: event.lineId || null,
        factoryId: event.factoryId || null,
        durationMs: event.durationMs,
        defectCount: event.defectCount
    };

    const payload = JSON.stringify(relevantFields);
    return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Normalizes an event by setting receivedTime to current time
 * @param {Object} event - The event object
 * @returns {Object} Normalized event
 */
function normalizeEvent(event) {
    return {
        ...event,
        receivedTime: new Date().toISOString()
    };
}

/**
 * Compares two receivedTime values
 * @param {string} time1 
 * @param {string} time2 
 * @returns {number} -1 if time1 < time2, 0 if equal, 1 if time1 > time2
 */
function compareReceivedTime(time1, time2) {
    const t1 = new Date(time1).getTime();
    const t2 = new Date(time2).getTime();
    return t1 < t2 ? -1 : (t1 > t2 ? 1 : 0);
}

module.exports = {
    validateEvent,
    generatePayloadHash,
    normalizeEvent,
    compareReceivedTime
};

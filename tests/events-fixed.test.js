const request = require('supertest');
const DatabaseManager = require('../src/database/db');
const EventService = require('../src/services/eventService');
const express = require('express');

// Create a test app
function createTestApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    const dbManager = new DatabaseManager(':memory:');
    const eventService = new EventService(dbManager);

    app.post('/events/batch', (req, res) => {
        try {
            const events = req.body;
            if (!Array.isArray(events)) {
                return res.status(400).json({ error: 'Request body must be an array of events' });
            }
            const results = eventService.processBatch(events);
            res.json(results);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    });

    app.get('/stats', (req, res) => {
        try {
            const { machineId, start, end } = req.query;
            if (!machineId || !start || !end) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }
            const stats = eventService.getStats(machineId, start, end);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    });

    app.get('/stats/top-defect-lines', (req, res) => {
        try {
            const { factoryId, from, to, limit = 10 } = req.query;
            if (!factoryId || !from || !to) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }
            const topLines = eventService.getTopDefectLines(factoryId, from, to, parseInt(limit, 10));
            res.json(topLines);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error', message: error.message });
        }
    });

    return { app, dbManager, eventService };
}

describe('Factory Event Backend Tests', () => {
    let app, dbManager, eventService;

    // Helper function to generate valid timestamps (not in future)
    const getValidTimestamp = (hoursAgo = 1) => {
        return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    };

    const getTimeRange = () => {
        const now = Date.now();
        return {
            past: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
            start: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
            middle: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            end: new Date(now + 1 * 60 * 60 * 1000).toISOString() // 1 hour from now
        };
    };

    beforeEach(() => {
        const testApp = createTestApp();
        app = testApp.app;
        dbManager = testApp.dbManager;
        eventService = testApp.eventService;
    });

    afterEach(() => {
        if (dbManager) {
            dbManager.close();
        }
    });

    /**
     * Test 1: Identical duplicate eventId → deduped
     */
    test('Test 1: Identical duplicate events should be deduped', async () => {
        const event = {
            eventId: 'E-001',
            eventTime: '2026-01-13T23:09:14.573Z',
            machineId: 'M-001',
            durationMs: 1000,
            defectCount: 0
        };

        // Send same event twice
        const response1 = await request(app)
            .post('/events/batch')
            .send([event]);

        expect(response1.status).toBe(200);
        expect(response1.body.accepted).toBe(1);

        const response2 = await request(app)
            .post('/events/batch')
            .send([event]);

        expect(response2.status).toBe(200);
        expect(response2.body.deduped).toBe(1);
        expect(response2.body.accepted).toBe(0);
    });

    /**
     * Test 2: Different payload + newer receivedTime → update happens
     */
    test('Test 2: Different payload with newer receivedTime should update', async () => {
        const event1 = {
            eventId: 'E-002',
            eventTime: '2026-01-13T23:09:14.574Z',
            machineId: 'M-001',
            durationMs: 1000,
            defectCount: 0
        };

        const response1 = await request(app)
            .post('/events/batch')
            .send([event1]);

        expect(response1.status).toBe(200);
        expect(response1.body.accepted).toBe(1);

        // Wait a bit to ensure newer receivedTime
        await new Promise(resolve => setTimeout(resolve, 10));

        const event2 = {
            eventId: 'E-002',
            eventTime: '2026-01-13T23:09:14.574Z',
            machineId: 'M-001',
            durationMs: 2000, // Different duration
            defectCount: 1 // Different defect count
        };

        const response2 = await request(app)
            .post('/events/batch')
            .send([event2]);

        expect(response2.status).toBe(200);
        expect(response2.body.updated).toBe(1);
        expect(response2.body.accepted).toBe(0);
    });

    /**
     * Test 3: Different payload + older receivedTime → ignored
     */
    test('Test 3: Different payload with older receivedTime should be ignored', async () => {
        // First, insert an event
        const event1 = {
            eventId: 'E-003',
            eventTime: '2026-01-13T23:09:14.574Z',
            machineId: 'M-001',
            durationMs: 1000,
            defectCount: 0
        };

        const response1 = await request(app)
            .post('/events/batch')
            .send([event1]);

        expect(response1.status).toBe(200);
        expect(response1.body.accepted).toBe(1);

        // Manually update the receivedTime to a future time
        dbManager.db.prepare('UPDATE events SET receivedTime = ? WHERE eventId = ?')
            .run('2026-01-14T01:09:14.574Z', 'E-003');

        // Now try to send an event with different payload but older receivedTime
        const event2 = {
            eventId: 'E-003',
            eventTime: '2026-01-13T23:09:14.574Z',
            machineId: 'M-001',
            durationMs: 2000,
            defectCount: 1
        };

        const response2 = await request(app)
            .post('/events/batch')
            .send([event2]);

        expect(response2.status).toBe(200);
        expect(response2.body.deduped).toBe(1);
        expect(response2.body.updated).toBe(0);
    });

    /**
     * Test 4: Invalid duration rejected
     */
    test('Test 4: Invalid duration should be rejected', async () => {
        const events = [
            {
                eventId: 'E-004',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-001',
                durationMs: -100, // Negative duration
                defectCount: 0
            },
            {
                eventId: 'E-005',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-001',
                durationMs: 7 * 60 * 60 * 1000, // More than 6 hours
                defectCount: 0
            }
        ];

        const response = await request(app)
            .post('/events/batch')
            .send(events);

        expect(response.status).toBe(200);
        expect(response.body.rejected).toBe(2);
        expect(response.body.rejections).toHaveLength(2);
        expect(response.body.rejections[0].reason).toBe('INVALID_DURATION');
        expect(response.body.rejections[1].reason).toBe('INVALID_DURATION');
    });

    /**
     * Test 5: Future eventTime rejected
     */
    test('Test 5: Future eventTime should be rejected', async () => {
        // Create a time more than 15 minutes in the future
        const futureTime = new Date(Date.now() + 20 * 60 * 1000).toISOString();

        const event = {
            eventId: 'E-006',
            eventTime: futureTime,
            machineId: 'M-001',
            durationMs: 1000,
            defectCount: 0
        };

        const response = await request(app)
            .post('/events/batch')
            .send([event]);

        expect(response.status).toBe(200);
        expect(response.body.rejected).toBe(1);
        expect(response.body.rejections[0].reason).toBe('FUTURE_EVENT_TIME');
    });

    /**
     * Test 6: DefectCount = -1 ignored in defect totals
     */
    test('Test 6: DefectCount = -1 should be ignored in defect calculations', async () => {
        const events = [
            {
                eventId: 'E-007',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-002',
                durationMs: 1000,
                defectCount: 5
            },
            {
                eventId: 'E-008',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-002',
                durationMs: 1000,
                defectCount: -1 // Unknown defects
            },
            {
                eventId: 'E-009',
                eventTime: '2026-01-14T00:09:14.574Z',
                machineId: 'M-002',
                durationMs: 1000,
                defectCount: 3
            }
        ];

        const response = await request(app)
            .post('/events/batch')
            .send(events);

        expect(response.status).toBe(200);
        expect(response.body.accepted).toBe(3);

        // Query stats
        const statsResponse = await request(app)
            .get('/stats')
            .query({
                machineId: 'M-002',
                start: '2026-01-13T22:09:14.574Z',
                end: '2026-01-14T01:09:14.574Z'
            });

        expect(statsResponse.status).toBe(200);
        expect(statsResponse.body.eventsCount).toBe(3);
        expect(statsResponse.body.defectsCount).toBe(8); // 5 + 3, ignoring -1
    });

    /**
     * Test 7: start/end boundary correctness (inclusive/exclusive)
     */
    test('Test 7: Time window boundaries should be inclusive/exclusive', async () => {
        const events = [
            {
                eventId: 'E-010',
                eventTime: '2026-01-13T23:09:14.574Z', // Exactly at start
                machineId: 'M-003',
                durationMs: 1000,
                defectCount: 1
            },
            {
                eventId: 'E-011',
                eventTime: '2026-01-14T00:09:14.574Z', // Exactly at end
                machineId: 'M-003',
                durationMs: 1000,
                defectCount: 1
            },
            {
                eventId: 'E-012',
                eventTime: '2026-01-13T23:09:14.574Z', // In the middle
                machineId: 'M-003',
                durationMs: 1000,
                defectCount: 1
            }
        ];

        await request(app)
            .post('/events/batch')
            .send(events);

        // Query with exact boundaries
        const statsResponse = await request(app)
            .get('/stats')
            .query({
                machineId: 'M-003',
                start: '2026-01-13T23:09:14.574Z',
                end: '2026-01-14T00:09:14.574Z'
            });

        expect(statsResponse.status).toBe(200);
        // Should include E-010 (at start) and E-012 (middle), but NOT E-011 (at end)
        expect(statsResponse.body.eventsCount).toBe(2);
        expect(statsResponse.body.defectsCount).toBe(2);
    });

    /**
     * Test 8: Thread-safety test - concurrent ingestion
     */
    test('Test 8: Concurrent batch ingestion should be thread-safe', async () => {
        // Create multiple batches to send concurrently
        const batches = [];
        for (let i = 0; i < 10; i++) {
            const batch = [];
            for (let j = 0; j < 100; j++) {
                batch.push({
                    eventId: `E-CONCURRENT-${i}-${j}`,
                    eventTime: '2026-01-13T23:09:14.574Z',
                    machineId: 'M-004',
                    durationMs: 1000,
                    defectCount: 1
                });
            }
            batches.push(batch);
        }

        // Send all batches concurrently
        const promises = batches.map(batch =>
            request(app)
                .post('/events/batch')
                .send(batch)
        );

        const responses = await Promise.all(promises);

        // Verify all requests succeeded
        responses.forEach(response => {
            expect(response.status).toBe(200);
        });

        // Verify total count
        const totalAccepted = responses.reduce((sum, r) => sum + r.body.accepted, 0);
        expect(totalAccepted).toBe(1000); // 10 batches * 100 events

        // Verify no duplicates were created
        const statsResponse = await request(app)
            .get('/stats')
            .query({
                machineId: 'M-004',
                start: '2026-01-13T22:09:14.574Z',
                end: '2026-01-14T01:09:14.574Z'
            });

        expect(statsResponse.body.eventsCount).toBe(1000);
    });

    /**
     * Additional Test: Top defect lines endpoint
     */
    test('Test 9: Top defect lines should return correct results', async () => {
        const events = [
            {
                eventId: 'E-LINE-001',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-005',
                factoryId: 'F01',
                lineId: 'LINE-A',
                durationMs: 1000,
                defectCount: 10
            },
            {
                eventId: 'E-LINE-002',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-006',
                factoryId: 'F01',
                lineId: 'LINE-B',
                durationMs: 1000,
                defectCount: 5
            },
            {
                eventId: 'E-LINE-003',
                eventTime: '2026-01-14T00:09:14.574Z',
                machineId: 'M-007',
                factoryId: 'F01',
                lineId: 'LINE-A',
                durationMs: 1000,
                defectCount: 8
            }
        ];

        await request(app)
            .post('/events/batch')
            .send(events);

        const response = await request(app)
            .get('/stats/top-defect-lines')
            .query({
                factoryId: 'F01',
                from: '2026-01-13T22:09:14.574Z',
                to: '2026-01-14T01:09:14.574Z',
                limit: 10
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);

        // LINE-A should be first (18 total defects)
        expect(response.body[0].lineId).toBe('LINE-A');
        expect(response.body[0].totalDefects).toBe(18);
        expect(response.body[0].eventCount).toBe(2);

        // LINE-B should be second (5 total defects)
        expect(response.body[1].lineId).toBe('LINE-B');
        expect(response.body[1].totalDefects).toBe(5);
        expect(response.body[1].eventCount).toBe(1);
    });

    /**
     * Additional Test: Health status calculation
     */
    test('Test 10: Health status should be calculated correctly', async () => {
        const events = [
            {
                eventId: 'E-HEALTH-001',
                eventTime: '2026-01-13T23:09:14.574Z',
                machineId: 'M-HEALTH',
                durationMs: 1000,
                defectCount: 5 // 5 defects in 1 hour = 5/hour (Warning)
            }
        ];

        await request(app)
            .post('/events/batch')
            .send(events);

        const response = await request(app)
            .get('/stats')
            .query({
                machineId: 'M-HEALTH',
                start: '2026-01-13T23:09:14.574Z',
                end: '2026-01-14T00:09:14.574Z' // 1 hour window
            });

        expect(response.status).toBe(200);
        expect(response.body.avgDefectRate).toBe(5);
        expect(response.body.status).toBe('Warning'); // >= 2.0
    });
});

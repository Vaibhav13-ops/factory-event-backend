const express = require('express');
const DatabaseManager = require('./database/db');
const EventService = require('./services/eventService');

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

// Middleware
app.use(express.json({ limit: '10mb' })); // Support large batch requests

// CORS middleware for API access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database and service
const dbManager = new DatabaseManager(); // In-memory by default, can be changed to file-based
const eventService = new EventService(dbManager);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /events/batch
 * Ingest a batch of events
 */
app.post('/events/batch', (req, res) => {
    try {
        const events = req.body;

        // Validate input is an array
        if (!Array.isArray(events)) {
            return res.status(400).json({
                error: 'Request body must be an array of events'
            });
        }

        // Process the batch
        const startTime = Date.now();
        const results = eventService.processBatch(events);
        const processingTime = Date.now() - startTime;

        // Add processing time to response for benchmarking
        results.processingTimeMs = processingTime;

        res.json(results);
    } catch (error) {
        console.error('Error processing batch:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /stats
 * Query statistics for a machine within a time window
 */
app.get('/stats', (req, res) => {
    try {
        const { machineId, start, end } = req.query;

        // Validate required parameters
        if (!machineId) {
            return res.status(400).json({ error: 'machineId is required' });
        }
        if (!start) {
            return res.status(400).json({ error: 'start is required' });
        }
        if (!end) {
            return res.status(400).json({ error: 'end is required' });
        }

        // Validate date formats
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Invalid start date format' });
        }
        if (isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid end date format' });
        }

        const stats = eventService.getStats(machineId, start, end);
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /stats/top-defect-lines
 * Get top defect lines for a factory
 */
app.get('/stats/top-defect-lines', (req, res) => {
    try {
        const { factoryId, from, to, limit = 10 } = req.query;

        // Validate required parameters
        if (!factoryId) {
            return res.status(400).json({ error: 'factoryId is required' });
        }
        if (!from) {
            return res.status(400).json({ error: 'from is required' });
        }
        if (!to) {
            return res.status(400).json({ error: 'to is required' });
        }

        // Validate date formats
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime())) {
            return res.status(400).json({ error: 'Invalid from date format' });
        }
        if (isNaN(toDate.getTime())) {
            return res.status(400).json({ error: 'Invalid to date format' });
        }

        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({ error: 'Invalid limit value' });
        }

        const topLines = eventService.getTopDefectLines(factoryId, from, to, limitNum);
        res.json(topLines);
    } catch (error) {
        console.error('Error getting top defect lines:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏭 Factory Event Backend Server`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📡 API Server: http://localhost:${PORT}`);
    console.log(`🎨 Dashboard: http://localhost:${PORT}/index.html`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        dbManager.close();
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server...');
    server.close(() => {
        dbManager.close();
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, dbManager, eventService };

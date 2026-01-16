const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: result });
                } catch (error) {
                    resolve({ statusCode: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Example 1: Ingest a batch of events
async function example1_ingestBatch() {
    console.log('\n=== Example 1: Ingest Batch of Events ===\n');

    const events = [
        {
            eventId: 'E-001',
            eventTime: '2026-01-15T10:00:00.000Z',
            machineId: 'M-001',
            lineId: 'LINE-A',
            factoryId: 'F01',
            durationMs: 4312,
            defectCount: 0
        },
        {
            eventId: 'E-002',
            eventTime: '2026-01-15T10:05:00.000Z',
            machineId: 'M-001',
            lineId: 'LINE-A',
            factoryId: 'F01',
            durationMs: 3890,
            defectCount: 2
        },
        {
            eventId: 'E-003',
            eventTime: '2026-01-15T10:10:00.000Z',
            machineId: 'M-001',
            lineId: 'LINE-A',
            factoryId: 'F01',
            durationMs: 4100,
            defectCount: -1 // Unknown defects
        }
    ];

    try {
        const response = await makeRequest('POST', '/events/batch', events);
        console.log('Status Code:', response.statusCode);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 2: Query statistics
async function example2_queryStats() {
    console.log('\n=== Example 2: Query Statistics ===\n');

    const params = new URLSearchParams({
        machineId: 'M-001',
        start: '2026-01-15T09:00:00.000Z',
        end: '2026-01-15T12:00:00.000Z'
    });

    try {
        const response = await makeRequest('GET', `/stats?${params}`);
        console.log('Status Code:', response.statusCode);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 3: Get top defect lines
async function example3_topDefectLines() {
    console.log('\n=== Example 3: Top Defect Lines ===\n');

    const params = new URLSearchParams({
        factoryId: 'F01',
        from: '2026-01-15T00:00:00.000Z',
        to: '2026-01-15T23:59:59.999Z',
        limit: 5
    });

    try {
        const response = await makeRequest('GET', `/stats/top-defect-lines?${params}`);
        console.log('Status Code:', response.statusCode);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 4: Demonstrate deduplication
async function example4_deduplication() {
    console.log('\n=== Example 4: Deduplication ===\n');

    const event = {
        eventId: 'E-DEDUP-001',
        eventTime: '2026-01-15T11:00:00.000Z',
        machineId: 'M-002',
        durationMs: 5000,
        defectCount: 1
    };

    console.log('Sending event first time...');
    const response1 = await makeRequest('POST', '/events/batch', [event]);
    console.log('Response 1:', JSON.stringify(response1.data, null, 2));

    console.log('\nSending same event again (should be deduped)...');
    const response2 = await makeRequest('POST', '/events/batch', [event]);
    console.log('Response 2:', JSON.stringify(response2.data, null, 2));
}

// Example 5: Demonstrate update logic
async function example5_updateLogic() {
    console.log('\n=== Example 5: Update Logic ===\n');

    const event1 = {
        eventId: 'E-UPDATE-001',
        eventTime: '2026-01-15T12:00:00.000Z',
        machineId: 'M-003',
        durationMs: 3000,
        defectCount: 1
    };

    console.log('Sending initial event...');
    const response1 = await makeRequest('POST', '/events/batch', [event1]);
    console.log('Response 1:', JSON.stringify(response1.data, null, 2));

    // Wait a bit to ensure newer receivedTime
    await new Promise(resolve => setTimeout(resolve, 100));

    const event2 = {
        eventId: 'E-UPDATE-001',
        eventTime: '2026-01-15T12:00:00.000Z',
        machineId: 'M-003',
        durationMs: 4000, // Different duration
        defectCount: 3 // Different defect count
    };

    console.log('\nSending updated event (different payload, newer receivedTime)...');
    const response2 = await makeRequest('POST', '/events/batch', [event2]);
    console.log('Response 2:', JSON.stringify(response2.data, null, 2));
}

// Example 6: Demonstrate validation
async function example6_validation() {
    console.log('\n=== Example 6: Validation Errors ===\n');

    const events = [
        {
            eventId: 'E-INVALID-001',
            eventTime: '2026-01-15T13:00:00.000Z',
            machineId: 'M-004',
            durationMs: -100, // Invalid: negative duration
            defectCount: 0
        },
        {
            eventId: 'E-INVALID-002',
            eventTime: '2030-01-15T13:00:00.000Z', // Invalid: too far in future
            machineId: 'M-004',
            durationMs: 1000,
            defectCount: 0
        },
        {
            eventId: 'E-VALID-001',
            eventTime: '2026-01-15T13:00:00.000Z',
            machineId: 'M-004',
            durationMs: 1000,
            defectCount: 0
        }
    ];

    try {
        const response = await makeRequest('POST', '/events/batch', events);
        console.log('Status Code:', response.statusCode);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run all examples
async function runAllExamples() {
    console.log('='.repeat(60));
    console.log('Factory Event Backend - Usage Examples');
    console.log('='.repeat(60));

    try {
        await example1_ingestBatch();
        await example2_queryStats();
        await example3_topDefectLines();
        await example4_deduplication();
        await example5_updateLogic();
        await example6_validation();

        console.log('\n' + '='.repeat(60));
        console.log('All examples completed!');
        console.log('='.repeat(60) + '\n');
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Check if server is running
async function checkServer() {
    try {
        const response = await makeRequest('GET', '/health');
        return response.statusCode === 200;
    } catch (error) {
        return false;
    }
}

// Main
(async () => {
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.error('ERROR: Server is not running on http://localhost:3000');
        console.error('Please start the server first: npm start');
        process.exit(1);
    }

    await runAllExamples();
})();

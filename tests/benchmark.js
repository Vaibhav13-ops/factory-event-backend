const http = require('http');

/**
 * Benchmark script for testing batch ingestion performance
 * Tests processing 1000 events in a single batch
 */

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Generate test events
function generateEvents(count, machineId = 'M-BENCH') {
    const events = [];
    const baseTime = new Date('2026-01-15T10:00:00.000Z');

    for (let i = 0; i < count; i++) {
        const eventTime = new Date(baseTime.getTime() + i * 1000);
        events.push({
            eventId: `E-BENCH-${i}`,
            eventTime: eventTime.toISOString(),
            machineId: machineId,
            lineId: `LINE-${i % 10}`,
            factoryId: 'F-BENCH',
            durationMs: Math.floor(Math.random() * 10000) + 100,
            defectCount: Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0
        });
    }

    return events;
}

// Send batch request
function sendBatch(events) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(events);

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/events/batch',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const startTime = Date.now();

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;

                try {
                    const result = JSON.parse(responseData);
                    resolve({
                        duration,
                        result,
                        statusCode: res.statusCode
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Check if server is running
function checkServer() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/health',
            method: 'GET',
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// Run benchmark
async function runBenchmark() {
    console.log('='.repeat(60));
    console.log('Factory Event Backend - Performance Benchmark');
    console.log('='.repeat(60));
    console.log();

    // Check if server is running
    console.log('Checking if server is running...');
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.error('ERROR: Server is not running on port', PORT);
        console.error('Please start the server first: npm start');
        process.exit(1);
    }

    console.log('✓ Server is running');
    console.log();

    // Test 1: Single batch of 1000 events
    console.log('Test 1: Processing 1000 events in a single batch');
    console.log('-'.repeat(60));

    const events1000 = generateEvents(1000);
    console.log(`Generated ${events1000.length} test events`);
    console.log(`Payload size: ${(JSON.stringify(events1000).length / 1024).toFixed(2)} KB`);
    console.log();

    try {
        const result = await sendBatch(events1000);

        console.log('Results:');
        console.log(`  Status Code: ${result.statusCode}`);
        console.log(`  Processing Time: ${result.duration} ms`);
        console.log(`  Accepted: ${result.result.accepted}`);
        console.log(`  Deduped: ${result.result.deduped}`);
        console.log(`  Updated: ${result.result.updated}`);
        console.log(`  Rejected: ${result.result.rejected}`);
        console.log();

        if (result.duration < 1000) {
            console.log('✓ PASSED: Processing time is under 1 second');
        } else {
            console.log('✗ FAILED: Processing time exceeds 1 second');
        }

        console.log();
        console.log(`Throughput: ${(events1000.length / (result.duration / 1000)).toFixed(2)} events/second`);
    } catch (error) {
        console.error('Error during benchmark:', error.message);
        process.exit(1);
    }

    console.log();
    console.log('-'.repeat(60));

    // Test 2: Multiple concurrent batches
    console.log();
    console.log('Test 2: Processing 10 concurrent batches of 100 events each');
    console.log('-'.repeat(60));

    const batches = [];
    for (let i = 0; i < 10; i++) {
        batches.push(generateEvents(100, `M-BENCH-${i}`));
    }

    console.log(`Generated ${batches.length} batches with 100 events each`);
    console.log();

    try {
        const startTime = Date.now();
        const promises = batches.map(batch => sendBatch(batch));
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        const totalAccepted = results.reduce((sum, r) => sum + r.result.accepted, 0);
        const totalRejected = results.reduce((sum, r) => sum + r.result.rejected, 0);

        console.log('Results:');
        console.log(`  Total Time: ${totalTime} ms`);
        console.log(`  Total Accepted: ${totalAccepted}`);
        console.log(`  Total Rejected: ${totalRejected}`);
        console.log(`  Average Time per Batch: ${(totalTime / batches.length).toFixed(2)} ms`);
        console.log();
        console.log(`Throughput: ${(1000 / (totalTime / 1000)).toFixed(2)} events/second`);
    } catch (error) {
        console.error('Error during concurrent benchmark:', error.message);
        process.exit(1);
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Benchmark Complete');
    console.log('='.repeat(60));
}

// Run the benchmark
runBenchmark().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

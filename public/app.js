// ===== Configuration =====
const API_BASE_URL = 'http://localhost:3000';
const REFRESH_INTERVAL = 5000; // 5 seconds

// ===== State Management =====
const state = {
    machines: new Map(),
    events: [],
    stats: {},
    alerts: [],
    currentView: 'overview'
};

// ===== Utility Functions =====
function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generateEventId() {
    return `E-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== Toast Notifications =====
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
            'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ===== Loading Overlay =====
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// ===== API Functions =====
async function ingestEvents(events) {
    try {
        const response = await fetch(`${API_BASE_URL}/events/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(events)
        });
        return await response.json();
    } catch (error) {
        console.error('Error ingesting events:', error);
        throw error;
    }
}

async function getStats(machineId, start, end) {
    try {
        const params = new URLSearchParams({ machineId, start, end });
        const response = await fetch(`${API_BASE_URL}/stats?${params}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
}

async function getTopDefectLines(factoryId, from, to, limit = 10) {
    try {
        const params = new URLSearchParams({ factoryId, from, to, limit });
        const response = await fetch(`${API_BASE_URL}/stats/top-defect-lines?${params}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching top defect lines:', error);
        throw error;
    }
}

// ===== UI Update Functions =====
function updateKPIs() {
    const totalEvents = state.events.length;
    const totalDefects = state.events.reduce((sum, e) => sum + (e.defectCount >= 0 ? e.defectCount : 0), 0);
    const healthyMachines = Array.from(state.machines.values()).filter(m => m.status === 'Healthy').length;

    const avgDefectRate = totalEvents > 0 ? (totalDefects / totalEvents).toFixed(2) : '0.0';

    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('totalDefects').textContent = totalDefects;
    document.getElementById('healthyMachines').textContent = healthyMachines;
    document.getElementById('avgDefectRate').textContent = avgDefectRate;
}

function updateMachineStatus() {
    const container = document.getElementById('machineStatusChart');
    const machines = Array.from(state.machines.values());

    if (machines.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No machine data available</p>';
        return;
    }

    container.innerHTML = machines.map(machine => `
        <div class="machine-status-item" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${machine.id}</div>
                <div style="font-size: 0.875rem; color: var(--text-muted);">${machine.events || 0} events</div>
            </div>
            <div class="event-badge ${machine.status === 'Healthy' ? 'healthy' : 'warning'}">
                ${machine.status}
            </div>
        </div>
    `).join('');
}

async function updateTopDefectLines() {
    try {
        const factoryId = document.getElementById('factoryFilter')?.value || 'F01';
        const to = new Date().toISOString();
        const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const lines = await getTopDefectLines(factoryId, from, to, 5);
        const container = document.getElementById('topDefectLines');

        if (lines.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No defect data available</p>';
            return;
        }

        const maxDefects = Math.max(...lines.map(l => l.totalDefects));

        container.innerHTML = lines.map((line, index) => `
            <div class="defect-line-item">
                <div class="defect-line-rank">#${index + 1}</div>
                <div class="defect-line-info">
                    <div class="defect-line-name">${line.lineId}</div>
                    <div class="defect-line-stats">${line.eventCount} events • ${line.defectsPercent}% defect rate</div>
                </div>
                <div class="defect-line-bar" style="width: 150px;">
                    <div class="defect-line-fill" style="width: ${(line.totalDefects / maxDefects) * 100}%"></div>
                </div>
                <div class="defect-line-value">${line.totalDefects}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating top defect lines:', error);
    }
}

function updateRecentEvents() {
    const container = document.getElementById('recentEvents');
    const recentEvents = state.events.slice(-10).reverse();

    if (recentEvents.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No events yet. Try simulating some events!</p>';
        return;
    }

    container.innerHTML = recentEvents.map(event => {
        const isHealthy = event.defectCount === 0 || event.defectCount === -1;
        return `
            <div class="event-item">
                <div class="event-icon ${isHealthy ? 'success' : 'warning'}">
                    <i class="fas ${isHealthy ? 'fa-check' : 'fa-exclamation-triangle'}"></i>
                </div>
                <div class="event-info">
                    <h4>${event.eventId} - ${event.machineId}</h4>
                    <p>${event.lineId || 'No line'} • Duration: ${event.durationMs}ms</p>
                </div>
                <div class="event-badge ${isHealthy ? 'healthy' : 'warning'}">
                    ${event.defectCount >= 0 ? `${event.defectCount} defects` : 'Unknown'}
                </div>
                <div class="event-time">${formatDate(event.eventTime)}</div>
            </div>
        `;
    }).join('');
}

function updateMachinesList() {
    const container = document.getElementById('machinesList');
    const machines = Array.from(state.machines.values());

    if (machines.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">No machines available. Simulate events to see machines.</p>';
        return;
    }

    container.innerHTML = machines.map(machine => `
        <div class="machine-card ${machine.status === 'Warning' ? 'warning' : ''}">
            <div class="machine-header">
                <div class="machine-id">${machine.id}</div>
                <div class="machine-status ${machine.status === 'Healthy' ? 'healthy' : 'warning'}">
                    ${machine.status}
                </div>
            </div>
            <div class="machine-stats">
                <div class="machine-stat">
                    <span class="machine-stat-value">${machine.events || 0}</span>
                    <span class="machine-stat-label">Events</span>
                </div>
                <div class="machine-stat">
                    <span class="machine-stat-value">${machine.defects || 0}</span>
                    <span class="machine-stat-label">Defects</span>
                </div>
                <div class="machine-stat">
                    <span class="machine-stat-value">${machine.defectRate || '0.0'}</span>
                    <span class="machine-stat-label">Defect Rate</span>
                </div>
                <div class="machine-stat">
                    <span class="machine-stat-value">${machine.uptime || '100'}%</span>
                    <span class="machine-stat-label">Uptime</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateAlerts() {
    const container = document.getElementById('alertsList');

    if (state.alerts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No alerts. All systems operational!</p>';
        document.getElementById('alertCount').textContent = '0';
        return;
    }

    document.getElementById('alertCount').textContent = state.alerts.length;

    container.innerHTML = state.alerts.map(alert => `
        <div class="alert-item ${alert.severity === 'critical' ? 'critical' : ''}">
            <div class="alert-icon">
                <i class="fas ${alert.severity === 'critical' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-description">${alert.description}</div>
                <div class="alert-time">${formatDate(alert.time)}</div>
            </div>
        </div>
    `).join('');
}

// ===== Event Handlers =====
async function handleEventSubmit(e) {
    e.preventDefault();

    const event = {
        eventId: document.getElementById('eventId').value,
        eventTime: new Date().toISOString(),
        machineId: document.getElementById('machineId').value,
        lineId: document.getElementById('lineId').value || undefined,
        factoryId: document.getElementById('factoryId').value || undefined,
        durationMs: parseInt(document.getElementById('durationMs').value),
        defectCount: parseInt(document.getElementById('defectCount').value)
    };

    try {
        showLoading();
        const result = await ingestEvents([event]);
        hideLoading();

        const resultBox = document.getElementById('ingestResult');
        resultBox.className = 'result-box show ' + (result.rejected > 0 ? 'error' : 'success');
        resultBox.innerHTML = `
            <h4>${result.rejected > 0 ? 'Event Rejected' : 'Event Ingested Successfully'}</h4>
            <p>Accepted: ${result.accepted} | Rejected: ${result.rejected} | Updated: ${result.updated}</p>
            ${result.rejections.length > 0 ? `<p>Reason: ${result.rejections[0].reason}</p>` : ''}
        `;

        if (result.accepted > 0) {
            state.events.push(event);
            updateDashboard();
            showToast('Success', 'Event ingested successfully', 'success');
            e.target.reset();
        } else {
            showToast('Error', result.rejections[0]?.reason || 'Event rejected', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Error', 'Failed to ingest event', 'error');
    }
}

async function handleStatsQuery(e) {
    e.preventDefault();

    const machineId = document.getElementById('statsMachineId').value;
    const hours = parseInt(document.getElementById('timeRange').value);
    const end = new Date().toISOString();
    const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
        showLoading();
        const stats = await getStats(machineId, start, end);
        hideLoading();

        const resultBox = document.getElementById('statsResult');
        resultBox.className = 'stats-result show';
        resultBox.innerHTML = `
            <h4>Statistics for ${machineId}</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-item-value">${stats.eventsCount}</span>
                    <span class="stat-item-label">Total Events</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.defectsCount}</span>
                    <span class="stat-item-label">Total Defects</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value">${stats.avgDefectRate}</span>
                    <span class="stat-item-label">Avg Defect Rate</span>
                </div>
                <div class="stat-item">
                    <span class="stat-item-value ${stats.status === 'Healthy' ? 'success' : 'warning'}" style="color: ${stats.status === 'Healthy' ? 'var(--success)' : 'var(--warning)'}">
                        ${stats.status}
                    </span>
                    <span class="stat-item-label">Status</span>
                </div>
            </div>
        `;

        showToast('Success', 'Statistics retrieved', 'success');
    } catch (error) {
        hideLoading();
        showToast('Error', 'Failed to fetch statistics', 'error');
    }
}

async function simulateEvents() {
    const machines = ['M-001', 'M-002', 'M-003'];
    const lines = ['LINE-A', 'LINE-B', 'LINE-C'];
    const factories = ['F01', 'F02'];

    const events = [];
    for (let i = 0; i < 20; i++) {
        events.push({
            eventId: generateEventId(),
            eventTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            machineId: machines[Math.floor(Math.random() * machines.length)],
            lineId: lines[Math.floor(Math.random() * lines.length)],
            factoryId: factories[Math.floor(Math.random() * factories.length)],
            durationMs: Math.floor(Math.random() * 5000) + 500,
            defectCount: Math.random() > 0.7 ? Math.floor(Math.random() * 5) : 0
        });
    }

    try {
        showLoading();
        const result = await ingestEvents(events);
        hideLoading();

        state.events.push(...events);
        updateDashboard();
        showToast('Success', `Simulated ${result.accepted} events`, 'success');

        // Update machine stats
        await updateMachineStats();
    } catch (error) {
        hideLoading();
        showToast('Error', 'Failed to simulate events', 'error');
    }
}

async function generateBatchEvents() {
    const machineId = document.getElementById('machineId').value;
    if (!machineId) {
        showToast('Error', 'Please select a machine first', 'error');
        return;
    }

    const events = [];
    for (let i = 0; i < 100; i++) {
        events.push({
            eventId: generateEventId(),
            eventTime: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            machineId: machineId,
            lineId: document.getElementById('lineId').value || undefined,
            factoryId: document.getElementById('factoryId').value || undefined,
            durationMs: Math.floor(Math.random() * 5000) + 500,
            defectCount: Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0
        });
    }

    try {
        showLoading();
        const result = await ingestEvents(events);
        hideLoading();

        const resultBox = document.getElementById('ingestResult');
        resultBox.className = 'result-box show success';
        resultBox.innerHTML = `
            <h4>Batch Events Generated</h4>
            <p>Accepted: ${result.accepted} | Rejected: ${result.rejected} | Processing Time: ${result.processingTimeMs}ms</p>
        `;

        state.events.push(...events);
        updateDashboard();
        showToast('Success', `Generated and ingested ${result.accepted} events in ${result.processingTimeMs}ms`, 'success');
    } catch (error) {
        hideLoading();
        showToast('Error', 'Failed to generate batch events', 'error');
    }
}

async function updateMachineStats() {
    const machineIds = ['M-001', 'M-002', 'M-003'];
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const machineId of machineIds) {
        try {
            const stats = await getStats(machineId, start, end);
            state.machines.set(machineId, {
                id: machineId,
                events: stats.eventsCount,
                defects: stats.defectsCount,
                defectRate: stats.avgDefectRate,
                status: stats.status,
                uptime: Math.floor(Math.random() * 10) + 90
            });
        } catch (error) {
            console.error(`Error fetching stats for ${machineId}:`, error);
        }
    }

    updateMachineStatus();
    updateMachinesList();
}

function updateDashboard() {
    updateKPIs();
    updateRecentEvents();
    updateMachineStatus();
    updateTopDefectLines();
    updateMachinesList();
}

// ===== Navigation =====
function switchView(viewName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}View`).classList.add('active');

    state.currentView = viewName;
}

// ===== Initialization =====
function updateClock() {
    document.getElementById('currentTime').textContent = formatTime(new Date());
}

async function init() {
    // Update clock
    setInterval(updateClock, 1000);
    updateClock();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
        });
    });

    // Event form
    const eventForm = document.getElementById('eventIngestForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }

    // Stats form
    const statsForm = document.getElementById('statsQueryForm');
    if (statsForm) {
        statsForm.addEventListener('submit', handleStatsQuery);
    }

    // Simulate button
    document.getElementById('simulateBtn')?.addEventListener('click', simulateEvents);

    // Generate batch button
    document.getElementById('generateBatchBtn')?.addEventListener('click', generateBatchEvents);

    // Refresh buttons
    document.getElementById('refreshEvents')?.addEventListener('click', updateDashboard);

    // Factory filter
    document.getElementById('factoryFilter')?.addEventListener('change', updateTopDefectLines);

    // Initial data load
    showToast('Welcome', 'Factory Monitoring Dashboard loaded', 'info');

    // Simulate some initial events
    setTimeout(() => {
        simulateEvents();
    }, 1000);

    // Auto-refresh
    setInterval(() => {
        if (state.currentView === 'overview') {
            updateDashboard();
        }
    }, REFRESH_INTERVAL);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

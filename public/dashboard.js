// Dashboard JavaScript
// Vanilla JS - No build process needed!

// State
let calls = [];
let billingData = null;
let tools = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    refreshAll();
});

// Tab Management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    // Load data for tab if needed
    if (tabName === 'calls' && calls.length === 0) loadCalls();
    if (tabName === 'billing' && !billingData) loadBilling();
    if (tabName === 'tools' && tools.length === 0) loadTools();
}

// Refresh All Data
async function refreshAll() {
    await Promise.all([
        loadCalls(),
        loadBilling(),
        loadTools()
    ]);
    updateStats();
}

// Load Calls
async function loadCalls() {
    try {
        const response = await fetch('/admin/calls?limit=20');
        const data = await response.json();
        calls = data.results || [];
        renderCalls();
        updateStats();
    } catch (error) {
        console.error('Error loading calls:', error);
        document.getElementById('callsTableBody').innerHTML =
            '<tr><td colspan="6" class="loading">Error loading calls</td></tr>';
    }
}

// Render Calls Table
function renderCalls() {
    const tbody = document.getElementById('callsTableBody');

    if (calls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No calls found</td></tr>';
        return;
    }

    tbody.innerHTML = calls.map(call => {
        const date = new Date(call.createdAt).toLocaleString();
        const duration = call.endedAt && call.startedAt
            ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
            : 'N/A';
        const cost = call.cost ? `$${call.cost.toFixed(4)}` : '$0.00';
        const status = call.status || 'unknown';
        const statusClass = status.replace('-', '');

        return `
            <tr>
                <td>${date}</td>
                <td>${call.phoneNumber || 'Unknown'}</td>
                <td>${duration}s</td>
                <td>${cost}</td>
                <td><span class="status status-${statusClass}">${status}</span></td>
                <td>
                    <button class="link-btn" onclick="viewCallDetails('${call.id}')">View Details</button>
                </td>
            </tr>
        `;
    }).join('');
}

// View Call Details
async function viewCallDetails(callId) {
    const modal = document.getElementById('callModal');
    const details = document.getElementById('callDetails');

    modal.style.display = 'block';
    details.innerHTML = '<p class="loading">Loading call details...</p>';

    try {
        const response = await fetch(`/admin/calls/${callId}`);
        const call = await response.json();

        let html = `
            <div class="detail-item">
                <div class="detail-label">Call ID</div>
                <div class="detail-value">${call.id}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Phone Number</div>
                <div class="detail-value">${call.phoneNumber || 'Unknown'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Type</div>
                <div class="detail-value">${call.type}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value"><span class="status status-${call.status}">${call.status}</span></div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">${new Date(call.createdAt).toLocaleString()}</div>
            </div>
        `;

        if (call.cost) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Cost Breakdown</div>
                    <div class="detail-value">
                        Total: $${call.cost.toFixed(4)}<br>
                        ${call.costBreakdown ? Object.entries(call.costBreakdown)
                            .map(([key, value]) => {
                                if (typeof value !== 'number') return `${key}: ${value}`;
                                if (key.toLowerCase().includes('token') || key.toLowerCase().includes('characters')) {
                                    return `${key}: ${Math.round(value)}`;
                                }
                                return `${key}: $${value.toFixed(4)}`;
                            })
                            .join('<br>')
                        : ''}
                    </div>
                </div>
            `;
        }

        if (call.transcript) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Transcript</div>
                    <div class="transcript">${call.transcript}</div>
                </div>
            `;
        }

        details.innerHTML = html;
    } catch (error) {
        console.error('Error loading call details:', error);
        details.innerHTML = '<p class="loading">Error loading call details</p>';
    }
}

// Close Modal
function closeModal() {
    document.getElementById('callModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('callModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Load Billing
async function loadBilling() {
    try {
        const response = await fetch('/admin/billing?limit=100');
        billingData = await response.json();
        renderBilling();
        updateStats();
    } catch (error) {
        console.error('Error loading billing:', error);
        document.getElementById('billingContent').innerHTML =
            '<p class="loading">Error loading billing data</p>';
    }
}

// Render Billing
function renderBilling() {
    const container = document.getElementById('billingContent');

    if (!billingData) {
        container.innerHTML = '<p class="loading">No billing data available</p>';
        return;
    }

    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-content">
                    <div class="stat-label">Total Cost</div>
                    <div class="stat-value">$${billingData.totalCost.toFixed(2)}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📞</div>
                <div class="stat-content">
                    <div class="stat-label">Total Calls</div>
                    <div class="stat-value">${billingData.callCount}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <div class="stat-label">Avg Cost/Call</div>
                    <div class="stat-value">$${(billingData.totalCost / billingData.callCount || 0).toFixed(4)}</div>
                </div>
            </div>
        </div>

        <h3 style="margin: 30px 0 16px;">Recent Charges</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Call ID</th>
                        <th>Duration</th>
                        <th>Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${billingData.calls.map(call => `
                        <tr>
                            <td>${new Date(call.createdAt).toLocaleString()}</td>
                            <td><button class="link-btn" onclick="viewCallDetails('${call.id}')">${call.id.substring(0, 12)}...</button></td>
                            <td>${call.duration ? call.duration.toFixed(0) + 's' : 'N/A'}</td>
                            <td>$${call.cost.toFixed(4)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Load Tools
async function loadTools() {
    try {
        const response = await fetch('/admin/tools');
        const data = await response.json();
        tools = data.results || [];
        renderTools();
        updateStats();
    } catch (error) {
        console.error('Error loading tools:', error);
        document.getElementById('toolsContent').innerHTML =
            '<p class="loading">Error loading tools</p>';
    }
}

// Render Tools
function renderTools() {
    const container = document.getElementById('toolsContent');

    if (tools.length === 0) {
        container.innerHTML = '<p class="loading">No tools configured. Run <code>npm run vapi:sync</code> to sync your tools.</p>';
        return;
    }

    const html = `
        <div class="tool-grid">
            ${tools.map(tool => `
                <div class="tool-card">
                    <div class="tool-name">${tool.function.name}</div>
                    <div class="tool-description">${tool.function.description}</div>
                    <div class="tool-params">
                        <strong>Parameters:</strong><br>
                        ${JSON.stringify(tool.function.parameters, null, 2)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// Update Stats
function updateStats() {
    // Total calls
    document.getElementById('totalCalls').textContent = calls.length;

    // Total cost
    if (billingData) {
        document.getElementById('totalCost').textContent = `$${billingData.totalCost.toFixed(2)}`;
    }

    // Average duration
    const durations = calls
        .filter(c => c.startedAt && c.endedAt)
        .map(c => (new Date(c.endedAt) - new Date(c.startedAt)) / 1000);

    if (durations.length > 0) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        document.getElementById('avgDuration').textContent = `${Math.round(avg)}s`;
    }

    // Active tools
    document.getElementById('activeTools').textContent = tools.length;
}

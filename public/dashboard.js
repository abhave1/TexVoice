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
    if (tabName === 'database') loadDatabaseCalls();
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
                            <td>$${call.cost ? call.cost.toFixed(4) : '0.0000'}</td>
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

// ==================== DATABASE TAB ====================

// Load Database Calls (with structured data)
async function loadDatabaseCalls() {
    const limit = document.getElementById('dbLimitSelect').value;
    const container = document.getElementById('databaseContent');
    container.innerHTML = '<p class="loading">Loading calls from database...</p>';

    try {
        const response = await fetch(`/admin/db/calls?limit=${limit}`);
        const data = await response.json();

        if (!data.calls || data.calls.length === 0) {
            container.innerHTML = '<p>No calls in database yet. Make some test calls to see structured data!</p>';
            return;
        }

        container.innerHTML = data.calls.map(call => renderDatabaseCall(call)).join('');
    } catch (error) {
        console.error('Failed to load database calls:', error);
        container.innerHTML = '<p class="loading">Error loading database calls</p>';
    }
}

// Render a single database call with structured data
function renderDatabaseCall(call) {
    const date = new Date(call.created_at);
    const intentBadge = call.intent_category
        ? `<span class="badge badge-${call.intent_category}">${call.intent_category}</span>`
        : '';
    const urgencyBadge = call.urgency
        ? `<span class="badge badge-${call.urgency}">${call.urgency}</span>`
        : '';

    return `
        <div class="call-card">
            <div class="call-header">
                <div>
                    <div style="font-weight: 600; font-size: 1.1rem;">
                        ${call.caller_name || call.caller_company || call.caller_phone || 'Unknown Caller'}
                    </div>
                    <div style="font-size: 0.85rem; color: #666; font-family: monospace; margin-top: 0.25rem;">${call.id}</div>
                    <div style="margin-top: 0.5rem;">
                        ${intentBadge} ${urgencyBadge}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.9rem; color: #666;">
                        ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
                    </div>
                    ${call.duration_seconds ? `<div style="margin-top: 0.25rem;">${call.duration_seconds}s</div>` : ''}
                    ${call.cost_total ? `<div>$${call.cost_total.toFixed(4)}</div>` : ''}
                    ${call.success_score ? `<div style="font-weight: 600; color: #2e7d32;">Score: ${call.success_score}/10</div>` : ''}
                </div>
            </div>

            ${renderStructuredSectionAlways(call, 'Caller Information', [
                { label: 'Name', value: call.caller_name },
                { label: 'Company', value: call.caller_company },
                { label: 'Phone', value: call.caller_phone },
                { label: 'Email', value: call.caller_email }
            ])}

            ${renderStructuredSectionAlways(call, 'Intent', [
                { label: 'Category', value: call.intent_category },
                { label: 'Subcategory', value: call.intent_subcategory }
            ])}

            ${renderStructuredSectionAlways(call, 'Machine Details', [
                { label: 'Make', value: call.machine_make },
                { label: 'Model', value: call.machine_model },
                { label: 'Year', value: call.machine_year },
                { label: 'Serial', value: call.machine_serial },
                { label: 'Category', value: call.machine_category }
            ])}

            ${renderStructuredSectionAlways(call, 'Call Details', [
                { label: 'Location', value: call.location },
                { label: 'Timing', value: call.timing },
                { label: 'Urgency', value: call.urgency }
            ])}

            ${renderStructuredSectionAlways(call, 'Outcome', [
                { label: 'Type', value: call.outcome_type },
                { label: 'Transferred To', value: call.outcome_transferred_to },
                { label: 'Next Step', value: call.outcome_next_step },
                { label: 'Callback Time', value: call.outcome_scheduled_callback_time }
            ])}

            <div class="structured-data-section">
                <h4>Notes</h4>
                <div style="padding: 0.5rem 0; color: ${call.notes ? '#333' : '#999'}; font-style: ${call.notes ? 'normal' : 'italic'};">
                    ${call.notes || 'Not collected'}
                </div>
            </div>

            <div class="structured-data-section">
                <h4>AI Summary</h4>
                <div style="padding: 0.5rem 0; color: ${call.summary ? '#333' : '#999'}; font-style: italic;">
                    ${call.summary || 'Not generated'}
                </div>
            </div>

            ${call.recording_url ? `
            <div class="structured-data-section">
                <h4>Recording</h4>
                <audio controls style="width: 100%; margin-top: 0.5rem;">
                    <source src="${call.recording_url}" type="audio/mpeg">
                </audio>
            </div>
            ` : ''}
        </div>
    `;
}

// Helper to render structured data sections (ALWAYS shows all fields)
function renderStructuredSectionAlways(call, title, fields) {
    const rows = fields.map(f => {
        const displayValue = f.value || '<span style="color: #999; font-style: italic;">Not collected</span>';
        return `
            <div class="data-row">
                <span class="data-label">${f.label}:</span>
                <span class="data-value">${displayValue}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="structured-data-section">
            <h4>${title}</h4>
            ${rows}
        </div>
    `;
}

// Helper to render structured data sections (LEGACY - only shows if data exists)
function renderStructuredSection(call, title, fields) {
    const hasData = fields.some(f => f.value);
    if (!hasData) return '';

    const rows = fields
        .filter(f => f.value)
        .map(f => `
            <div class="data-row">
                <span class="data-label">${f.label}:</span>
                <span class="data-value">${f.value}</span>
            </div>
        `).join('');

    return `
        <div class="structured-data-section">
            <h4>${title}</h4>
            ${rows}
        </div>
    `;
}

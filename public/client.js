// Client Portal JavaScript

let currentConfig = null;
let availablePhoneNumbers = [];

// Check authentication on page load
const token = localStorage.getItem('client_token');
if (!token) {
    window.location.href = '/login.html';
}

// API headers with auth
const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    await loadPhoneNumbers();
});

/**
 * Load current configuration
 */
async function loadConfig() {
    try {
        const response = await fetch('/client/config', {
            headers: authHeaders
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.success && data.config) {
            currentConfig = data.config;
            populateForm(data.config);
        }
    } catch (error) {
        console.error('Error loading config:', error);
        showError('Failed to load configuration');
    }
}

/**
 * Load available phone numbers from Vapi
 */
async function loadPhoneNumbers() {
    try {
        const response = await fetch('/client/phone-numbers', {
            headers: authHeaders
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.success && data.phoneNumbers) {
            availablePhoneNumbers = data.phoneNumbers;
            populatePhoneDropdown(data.phoneNumbers);
        }
    } catch (error) {
        console.error('Error loading phone numbers:', error);
        const select = document.getElementById('vapiPhoneSelect');
        select.innerHTML = '<option value="">Failed to load phone numbers</option>';
    }
}

/**
 * Populate form with existing config
 */
function populateForm(config) {
    document.getElementById('clientName').value = config.name || '';
    document.getElementById('company').value = config.company || '';
    document.getElementById('customPrompt').value = config.custom_prompt || '';
    document.getElementById('firstMessage').value = config.first_message_template || '';
    document.getElementById('salesPhone').value = config.sales_phone || '';
    document.getElementById('servicePhone').value = config.service_phone || '';
    document.getElementById('partsPhone').value = config.parts_phone || '';
    document.getElementById('enableInventory').checked = Boolean(config.enable_inventory);
    document.getElementById('enableTransfers').checked = Boolean(config.enable_transfers);

    // Set manual phone field
    if (config.phone_number) {
        document.getElementById('manualPhone').value = config.phone_number;
    }

    // Phone dropdown will be set after phone numbers load
    if (config.vapi_phone_number_id) {
        setTimeout(() => {
            const select = document.getElementById('vapiPhoneSelect');
            select.value = config.vapi_phone_number_id;
        }, 100);
    }
}

/**
 * Populate phone number dropdown
 */
function populatePhoneDropdown(phoneNumbers) {
    const select = document.getElementById('vapiPhoneSelect');

    if (phoneNumbers.length === 0) {
        select.innerHTML = '<option value="">No phone numbers available</option>';
        return;
    }

    select.innerHTML = '<option value="">Select a phone number...</option>';
    phoneNumbers.forEach(phone => {
        const option = document.createElement('option');
        option.value = phone.id;
        option.textContent = `${phone.number} (${phone.name})`;
        select.appendChild(option);
    });

    // Set current value if exists
    if (currentConfig && currentConfig.vapi_phone_number_id) {
        select.value = currentConfig.vapi_phone_number_id;
    }
}

/**
 * Handle form submission (save only)
 */
document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveConfig(false);
});

/**
 * Save configuration
 */
async function saveConfig(shouldSync = false) {
    hideMessages();

    // Get form data
    const formData = getFormData();

    try {
        const response = await fetch('/client/config', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.success) {
            currentConfig = data.config;
            showSuccess('Configuration saved successfully');

            // If should sync, trigger sync
            if (shouldSync) {
                await performSync();
            }
        } else {
            showError(data.message || 'Failed to save configuration');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        showError('Failed to save configuration');
    }
}

/**
 * Get form data
 */
function getFormData() {
    const vapiPhoneSelect = document.getElementById('vapiPhoneSelect').value;
    const manualPhone = document.getElementById('manualPhone').value;

    // Determine which phone to use
    let phoneNumber = null;
    let vapiPhoneNumberId = null;

    if (vapiPhoneSelect) {
        // Use dropdown selection
        vapiPhoneNumberId = vapiPhoneSelect;
        const selectedPhone = availablePhoneNumbers.find(p => p.id === vapiPhoneSelect);
        phoneNumber = selectedPhone ? selectedPhone.number : null;
    } else if (manualPhone) {
        // Use manual entry
        phoneNumber = manualPhone;
        // Try to find matching ID
        const matchingPhone = availablePhoneNumbers.find(p => p.number === manualPhone);
        vapiPhoneNumberId = matchingPhone ? matchingPhone.id : null;
    }

    return {
        name: document.getElementById('clientName').value,
        company: document.getElementById('company').value || null,
        phoneNumber: phoneNumber,
        vapiPhoneNumberId: vapiPhoneNumberId,
        enableInventory: document.getElementById('enableInventory').checked,
        enableTransfers: document.getElementById('enableTransfers').checked,
        customPrompt: document.getElementById('customPrompt').value || null,
        firstMessage: document.getElementById('firstMessage').value || null,
        salesPhone: document.getElementById('salesPhone').value || null,
        servicePhone: document.getElementById('servicePhone').value || null,
        partsPhone: document.getElementById('partsPhone').value || null
    };
}

/**
 * Save and sync immediately
 */
async function syncNow() {
    await saveConfig(true);
}

/**
 * Perform sync with Vapi
 */
async function performSync() {
    const syncProgress = document.getElementById('syncProgress');
    const syncSteps = document.getElementById('syncSteps');

    syncProgress.style.display = 'block';
    syncSteps.innerHTML = '<div class="sync-step pending">Preparing to sync...</div>';

    try {
        const response = await fetch('/client/sync', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({})
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.success) {
            // Display sync steps
            let stepsHtml = '';
            data.steps.forEach(step => {
                const status = step.success ? 'success' : 'error';
                const icon = step.success ? '✅' : '❌';
                stepsHtml += `<div class="sync-step ${status}">${icon} ${step.name}: ${step.action || step.error || 'completed'}</div>`;
            });

            if (data.assistantId) {
                stepsHtml += `<div class="sync-step success"><strong>Assistant ID:</strong> ${data.assistantId}</div>`;
            }
            if (data.phoneNumber) {
                stepsHtml += `<div class="sync-step success"><strong>Phone Number:</strong> ${data.phoneNumber}</div>`;
            }

            syncSteps.innerHTML = stepsHtml;
            showSuccess('Configuration synced successfully with Vapi!');
        } else {
            let stepsHtml = '';
            if (data.steps && data.steps.length > 0) {
                data.steps.forEach(step => {
                    const status = step.success ? 'success' : 'error';
                    const icon = step.success ? '✅' : '❌';
                    stepsHtml += `<div class="sync-step ${status}">${icon} ${step.name}: ${step.action || step.error || 'completed'}</div>`;
                });
            }
            syncSteps.innerHTML = stepsHtml || '<div class="sync-step error">Sync failed</div>';
            showError(data.message || 'Sync failed');
        }
    } catch (error) {
        console.error('Error syncing:', error);
        syncSteps.innerHTML = '<div class="sync-step error">❌ Network error during sync</div>';
        showError('Sync failed: Network error');
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => {
        successEl.style.display = 'none';
    }, 5000);
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

/**
 * Hide all messages
 */
function hideMessages() {
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

/**
 * Logout
 */
function logout() {
    localStorage.removeItem('client_token');
    window.location.href = '/login.html';
}

/**
 * Sync phone number fields
 */
document.getElementById('vapiPhoneSelect').addEventListener('change', (e) => {
    if (e.target.value) {
        // Clear manual input when dropdown is selected
        const selectedPhone = availablePhoneNumbers.find(p => p.id === e.target.value);
        if (selectedPhone) {
            document.getElementById('manualPhone').value = selectedPhone.number;
        }
    }
});

document.getElementById('manualPhone').addEventListener('input', (e) => {
    if (e.target.value) {
        // Try to match with dropdown
        const matchingPhone = availablePhoneNumbers.find(p => p.number === e.target.value);
        if (matchingPhone) {
            document.getElementById('vapiPhoneSelect').value = matchingPhone.id;
        } else {
            document.getElementById('vapiPhoneSelect').value = '';
        }
    }
});

/**
 * Load calls for this client
 */
async function loadCalls() {
    const container = document.getElementById('callsContainer');
    container.innerHTML = '<p>Loading calls...</p>';

    try {
        const response = await fetch('/client/calls?limit=25', {
            headers: authHeaders
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();

        if (data.success && data.calls) {
            displayCalls(data.calls);
        } else {
            container.innerHTML = '<p style="color: #991B1B;">Failed to load calls</p>';
        }
    } catch (error) {
        console.error('Error loading calls:', error);
        container.innerHTML = '<p style="color: #991B1B;">Error loading calls</p>';
    }
}

/**
 * Display calls in table
 */
function displayCalls(calls) {
    const container = document.getElementById('callsContainer');

    if (calls.length === 0) {
        container.innerHTML = '<p style="color: rgba(0, 0, 0, 0.6);">No calls found</p>';
        return;
    }

    let html = `
        <table class="calls-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Caller</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Intent</th>
                </tr>
            </thead>
            <tbody>
    `;

    calls.forEach(call => {
        const startDate = new Date(call.startedAt);
        const endDate = call.endedAt ? new Date(call.endedAt) : null;
        const duration = endDate ? Math.round((endDate - startDate) / 1000) : 0;
        const cost = call.cost ? `$${call.cost.toFixed(4)}` : 'N/A';
        const caller = call.customer?.number || 'Unknown';
        const intent = call.structuredData?.intent_category || 'N/A';

        html += `
            <tr onclick="showCallDetails('${call.id}')">
                <td>${startDate.toLocaleString()}</td>
                <td>${caller}</td>
                <td>${duration}s</td>
                <td><span class="call-status ${call.status}">${call.status}</span></td>
                <td>${cost}</td>
                <td>${intent}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;

    // Store calls for modal access
    window.callsData = calls;
}

/**
 * Show call details in modal
 */
async function showCallDetails(callId) {
    const call = window.callsData?.find(c => c.id === callId);
    if (!call) return;

    const modal = document.getElementById('callModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalCallId');

    modalTitle.textContent = `Call: ${callId.substring(0, 8)}...`;

    // Build modal content
    let html = `
        <div class="detail-section">
            <h4>Call Information</h4>
            <div class="detail-row">
                <div class="detail-label">Caller</div>
                <div class="detail-value">${call.customer?.number || 'Unknown'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Started</div>
                <div class="detail-value">${new Date(call.startedAt).toLocaleString()}</div>
            </div>
            ${call.endedAt ? `
            <div class="detail-row">
                <div class="detail-label">Ended</div>
                <div class="detail-value">${new Date(call.endedAt).toLocaleString()}</div>
            </div>
            ` : ''}
            <div class="detail-row">
                <div class="detail-label">Status</div>
                <div class="detail-value"><span class="call-status ${call.status}">${call.status}</span></div>
            </div>
            ${call.endedReason ? `
            <div class="detail-row">
                <div class="detail-label">End Reason</div>
                <div class="detail-value">${call.endedReason}</div>
            </div>
            ` : ''}
        </div>

        <div class="detail-section">
            <h4>Cost Breakdown</h4>
            <div class="detail-row">
                <div class="detail-label">Total Cost</div>
                <div class="detail-value">${call.cost ? `$${call.cost.toFixed(4)}` : 'N/A'}</div>
            </div>
            ${call.costBreakdown ? `
                ${call.costBreakdown.llm ? `
                <div class="detail-row">
                    <div class="detail-label">LLM Cost</div>
                    <div class="detail-value">$${call.costBreakdown.llm.toFixed(4)}</div>
                </div>
                ` : ''}
                ${call.costBreakdown.voice ? `
                <div class="detail-row">
                    <div class="detail-label">Voice Cost</div>
                    <div class="detail-value">$${call.costBreakdown.voice.toFixed(4)}</div>
                </div>
                ` : ''}
                ${call.costBreakdown.vapi ? `
                <div class="detail-row">
                    <div class="detail-label">Vapi Cost</div>
                    <div class="detail-value">$${call.costBreakdown.vapi.toFixed(4)}</div>
                </div>
                ` : ''}
            ` : ''}
        </div>

        ${call.structuredData ? `
        <div class="detail-section">
            <h4>Structured Data</h4>
            <div class="detail-row">
                <div class="detail-label">Intent</div>
                <div class="detail-value">${call.structuredData.intent_category || 'N/A'}</div>
            </div>
            ${call.structuredData.machine_make ? `
            <div class="detail-row">
                <div class="detail-label">Machine Make</div>
                <div class="detail-value">${call.structuredData.machine_make}</div>
            </div>
            ` : ''}
            ${call.structuredData.machine_model ? `
            <div class="detail-row">
                <div class="detail-label">Machine Model</div>
                <div class="detail-value">${call.structuredData.machine_model}</div>
            </div>
            ` : ''}
            ${call.structuredData.outcome_type ? `
            <div class="detail-row">
                <div class="detail-label">Outcome</div>
                <div class="detail-value">${call.structuredData.outcome_type}</div>
            </div>
            ` : ''}
        </div>
        ` : ''}

        ${call.summary ? `
        <div class="detail-section">
            <h4>Summary</h4>
            <div class="transcript-text">${call.summary}</div>
        </div>
        ` : ''}

        ${call.transcript ? `
        <div class="detail-section">
            <h4>Transcript</h4>
            <div class="transcript-text">${call.transcript}</div>
        </div>
        ` : ''}

        ${call.recordingUrl ? `
        <div class="detail-section">
            <h4>Recording</h4>
            <audio controls style="width: 100%;">
                <source src="${call.recordingUrl}" type="audio/mpeg">
                Your browser does not support audio playback.
            </audio>
        </div>
        ` : ''}
    `;

    modalBody.innerHTML = html;
    modal.classList.add('show');
}

/**
 * Close call details modal
 */
function closeCallModal() {
    const modal = document.getElementById('callModal');
    modal.classList.remove('show');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('callModal');
    if (event.target === modal) {
        closeCallModal();
    }
};

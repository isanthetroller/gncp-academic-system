/**
 * ================================================================
 *  GNCP Enrollment Stations — Shared Data Bus  v1.2
 * ================================================================
 *
 *  Corrected Theoretical Flow (Best Practice):
 *  1. Online Pre-Reg
 *  2. Registrar Verification & Admission (Room 1109) -> sets advising step IN_PROGRESS
 *  3. Academic Advising & NSTP (TLC Helpdesk) -> Step 2
 *  4. Medical Clearance (Fit / Unfit check) -> Step 3 (handled by medical-checkup)
 *  5. Scholarship Verification -> Step 4 (handled by scholarship-verification)
 *  6. Cashier Payment (Clear Ledger Balance) -> Step 5 (handled by payment-processing)
 *  7. IT Center: ID Photo & Portal Activation -> Step 6 (handled by it-center)
 *
 *  NOTE: requirements-verification station has been REMOVED from the flow.
 *        The registrar handles document admission directly.
 *  SCHEMA VERSION: 2
 * ================================================================
 */

const SCHEMA_VERSION = 3;
const STORAGE_KEY    = 'gncp_enrollment_queue';

class StationDataBus {
    static _syncing = false;

    static getApiUrl(action) {
        const path = window.location.pathname;
        const isSubdir = path.includes('/stations/') && !path.endsWith('/stations/') && !path.includes('dashboard.html');
        const base = isSubdir ? '../backend/api.php' : 'backend/api.php';
        return `${base}?action=${action}`;
    }

    static getQueue() {
        // Fetch updates from backend asynchronously in the background
        this.syncWithBackend();

        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    static saveQueue(queue) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }

    static getStudentByRef(refNo) {
        return this.getQueue().find(s => s.referenceNumber === refNo) || null;
    }

    static updateStudent(refNo, updateFn) {
        const queue = this.getQueue();
        const idx   = queue.findIndex(s => s.referenceNumber === refNo);
        if (idx === -1) {
            console.warn(`[DataBus] Student not found: ${refNo}`);
            return null;
        }
        updateFn(queue[idx]);
        this.saveQueue(queue);

        // Async dispatch updates to PHP/MySQL backend (skip if student was promoted / ENROLLED)
        if (queue[idx].status !== 'ENROLLED') {
            this.sendUpdateToBackend(refNo, queue[idx]);
        }

        return queue[idx];
    }

    // ----------------------------------------------------------------
    // BACKEND SYNC OPERATIONS (Background Cache Sync)
    // ----------------------------------------------------------------

    static async syncWithBackend() {
        if (this._syncing) return;
        this._syncing = true;

        try {
            const response = await fetch(this.getApiUrl('fetch_queue'));
            if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    const localRaw = localStorage.getItem(STORAGE_KEY);
                    const dbRaw = JSON.stringify(result.data);
                    
                    // Only reload and dispatch storage events if data changed
                    if (localRaw !== dbRaw) {
                        localStorage.setItem(STORAGE_KEY, dbRaw);
                        // Trigger reload in the active tab
                        window.dispatchEvent(new Event('storage'));
                    }
                }
            }
        } catch (err) {
            console.warn('[DataBus] Live server unreachable. Operating in local storage mode.', err);
        } finally {
            this._syncing = false;
        }
    }

    static async sendUpdateToBackend(refNo, studentData) {
        try {
            // Role-isolated atomic payload filtering (prevents concurrent stale overrides)
            const stored = sessionStorage.getItem('gncp_station_user') || sessionStorage.getItem('gncp_admin_user');
            const role = stored ? JSON.parse(stored).role : '';
            
            const ROLE_PAYLOAD_MAP = {
                'REGISTRAR': ['requirements', 'status', 'sectionCode'],
                'HELPDESK': ['helpdesk', 'payment'],
                'ADMIN': ['helpdesk', 'payment'],
                'SUPER_ADMIN': ['helpdesk', 'payment'],
                'MEDICAL': ['medical'],
                'CASHIER': ['payment'],
                'IT_CENTER': ['enrollment', 'status']
            };

            const filteredUpdate = {
                roadmap: studentData.roadmap
            };

            const allowedKeys = ROLE_PAYLOAD_MAP[role];
            if (allowedKeys) {
                allowedKeys.forEach(key => {
                    if (studentData[key] !== undefined) {
                        const apiKey = key === 'sectionCode' ? 'section_code' : key;
                        filteredUpdate[apiKey] = studentData[key];
                    }
                });
            } else {
                Object.assign(filteredUpdate, studentData);
            }

            const response = await fetch(this.getApiUrl('update_student'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referenceNumber: refNo,
                    updateData: filteredUpdate
                })
            });
            if (!response.ok) {
                console.error('[DataBus] PHP backend rejected update for student:', refNo);
            }
        } catch (err) {
            console.error('[DataBus] Failed to sync updates to backend server:', err);
        }
    }

    /** Wipe local cache and trigger refresh from database */
    static resetQueue() {
        localStorage.removeItem(STORAGE_KEY);
        this.syncWithBackend();
        return [];
    }

    /** Remove the stored queue cache */
    static clearSeed() {
        localStorage.removeItem(STORAGE_KEY);
    }
}

// Expose globally for CDN Vue usage (no bundler)
window.StationDataBus = StationDataBus;

// Trigger immediate sync on load and poll every 4 seconds in the background
if (typeof window !== 'undefined') {
    setTimeout(() => StationDataBus.syncWithBackend(), 50);
    setInterval(() => StationDataBus.syncWithBackend(), 4000);
}

// Initial cache setup
StationDataBus.getQueue();

/**
 * ================================================================
 *  GNCP Enrollment Stations — Shared Data Bus  v3.0
 *  - Single source of truth: REST API gateway (api/index.php)
 *  - Delta-only updates: sends only changed fields per station
 *  - Exponential backoff: adapts polling interval on failures
 * ================================================================
 */

const STORAGE_KEY = 'gncp_enrollment_queue';

class StationDataBus {
    static _syncing = false;
    static _consecutiveFailures = 0;
    static _pollTimer = null;
    static _lastEtag = null;

    static getApiUrl(action) {
        let baseApi = '/systemtest/api/index.php';
        if (action === 'fetch_queue') {
            return `${baseApi}?action=stations/queue`;
        } else if (action === 'update_student') {
            return `${baseApi}?action=stations/update`;
        }
        return `${baseApi}?action=${action}`;
    }

    static getQueue() {
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

    /**
     * Updates a student record locally and syncs the delta to the backend.
     * @param {string} refNo - The student reference number.
     * @param {function} updateFn - Callback that mutates the student object.
     * @param {string[]} [deltaKeys] - If provided, only these keys are sent to the backend.
     *   Examples: ['medical','roadmap'], ['payment','roadmap'], ['enrollment','roadmap','status']
     *   If omitted, the full student object is sent (legacy fallback).
     */
    static updateStudent(refNo, updateFn, deltaKeys = null) {
        const queue = this.getQueue();
        const idx   = queue.findIndex(s => s.referenceNumber === refNo);
        if (idx === -1) {
            console.warn(`[DataBus] Student not found: ${refNo}`);
            return null;
        }
        updateFn(queue[idx]);
        this.saveQueue(queue);

        this.sendUpdateToBackend(refNo, queue[idx], deltaKeys);
        return queue[idx];
    }

    static async syncWithBackend() {
        if (this._syncing) return;
        this._syncing = true;

        try {
            const headers = {};
            if (this._lastEtag) {
                headers['If-None-Match'] = this._lastEtag;
            }

            const response = await fetch(this.getApiUrl('fetch_queue'), { headers });

            if (response.status === 304) {
                // Queue has not changed — skip JSON decoding and localStorage write
                StationDataBus._consecutiveFailures = 0;
                return;
            }

            if (response.ok) {
                const etagHeader = response.headers.get('ETag');
                if (etagHeader) {
                    this._lastEtag = etagHeader;
                }
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    const dbRaw = JSON.stringify(result.data);
                    const localRaw = localStorage.getItem(STORAGE_KEY);
                    if (localRaw !== dbRaw) {
                        localStorage.setItem(STORAGE_KEY, dbRaw);
                        window.dispatchEvent(new Event('storage'));
                    }
                }
            }
            // Reset failure counter on success
            StationDataBus._consecutiveFailures = 0;
        } catch (err) {
            console.warn('[DataBus] REST API sync error:', err);
            StationDataBus._consecutiveFailures++;
        } finally {
            this._syncing = false;
        }
    }

    /**
     * Sends a student update to the backend.
     * When deltaKeys is provided, only those fields are included in updateData.
     * This prevents one station from overwriting another station's concurrent changes.
     */
    static async sendUpdateToBackend(refNo, studentData, deltaKeys = null) {
        try {
            let updateData;
            if (deltaKeys && Array.isArray(deltaKeys) && deltaKeys.length > 0) {
                // Delta mode: send only the changed fields
                updateData = {};
                for (const key of deltaKeys) {
                    if (key in studentData) {
                        updateData[key] = studentData[key];
                    }
                }
            } else {
                // Legacy fallback: send full student object
                updateData = studentData;
            }

            const response = await fetch(this.getApiUrl('update_student'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referenceNumber: refNo,
                    updateData: updateData
                })
            });
            if (response.ok) {
                // Immediately refresh database queue after write
                this.syncWithBackend();
            } else {
                console.error('[DataBus] REST API rejected update for student:', refNo);
            }
        } catch (err) {
            console.error('[DataBus] Failed to send REST API update:', err);
        }
    }

    static resetQueue() {
        localStorage.removeItem(STORAGE_KEY);
        this.syncWithBackend();
        return [];
    }
}

window.StationDataBus = StationDataBus;

/**
 * Adaptive polling engine with exponential backoff.
 * On consecutive failures: 3s → 3s → 10s → 30s → 60s, then holds.
 * Resets to 3s immediately on first success.
 */
(function schedulePoll() {
    if (typeof window === 'undefined') return;

    const delays = [3000, 3000, 10000, 30000, 60000];

    async function poll() {
        await StationDataBus.syncWithBackend();
        const nextDelay = delays[Math.min(StationDataBus._consecutiveFailures, delays.length - 1)];
        StationDataBus._pollTimer = setTimeout(poll, nextDelay);
    }

    // Initial sync after 50ms, then begin adaptive polling
    setTimeout(() => {
        StationDataBus.syncWithBackend();
        StationDataBus._pollTimer = setTimeout(poll, 3000);
    }, 50);
})();

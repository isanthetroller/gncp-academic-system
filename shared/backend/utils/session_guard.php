<?php
/**
 * GNCP Unified Session Guard
 * Validates active session and enforces role-based access control across API endpoints.
 */

require_once __DIR__ . '/response.php';

function requireAuth(array $allowedRoles = []) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $adminSession   = $_SESSION['gncp_admin_user'] ?? null;
    $stationSession = $_SESSION['gncp_station_user'] ?? null;

    // Release session lock immediately so read operations do not block or overwrite session state
    session_write_close();

    $userVal = $adminSession ?: $stationSession;

    if (!$userVal) {
        sendResponse(false, null, 'Authentication required. Please log in.', 401);
    }

    $user = is_array($userVal) ? $userVal : json_decode($userVal, true);

    if (!$user || empty($user['role'])) {
        sendResponse(false, null, 'Invalid session state.', 401);
    }

    if (!empty($allowedRoles)) {
        $normalizedAllowed = array_map('strtoupper', $allowedRoles);
        $userRole = strtoupper($user['role']);
        if (!in_array($userRole, $normalizedAllowed, true)) {
            sendResponse(false, null, "Forbidden: insufficient role permissions (Active role: '{$userRole}').", 403);
        }
    }

    return $user;
}

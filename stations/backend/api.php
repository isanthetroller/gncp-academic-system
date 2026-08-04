<?php
/**
 * GNCP Workstations — Unified API Gateway Router
 * Modular router delegating to QueueService, EnrollmentService, and PaymentService.
 */

require_once __DIR__ . '/../../shared/backend/config/database.php';
require_once __DIR__ . '/../../shared/backend/utils/logger.php';
require_once __DIR__ . '/../../shared/backend/utils/response.php';
require_once __DIR__ . '/../../shared/backend/utils/student.php';

require_once __DIR__ . '/services/QueueService.php';
require_once __DIR__ . '/services/PaymentService.php';
require_once __DIR__ . '/services/EnrollmentService.php';

// Emit X-Request-ID correlation header for all station API responses
$stationReqId = getRequestId();
header('X-Request-ID: ' . $stationReqId);

$action = $_GET['action'] ?? '';

try {
    $pdo = Database::getInstance();

    if ($action === 'fetch_queue') {
        $queue = QueueService::fetchQueue($pdo);
        sendResponse(true, $queue);

    } elseif ($action === 'update_student') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse(false, null, 'Method not allowed. Use POST.', 405);
        }

        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true);

        if (!$payload || !isset($payload['referenceNumber'])) {
            sendResponse(false, null, 'Invalid payload or missing referenceNumber.', 400);
        }

        $resData = EnrollmentService::updateStudent($pdo, $payload);
        sendResponse(true, $resData, 'Student record updated successfully.');

    } elseif ($action === 'get_next_student_id') {
        $nextId = generateUniqueStudentId($pdo, '2026');
        sendResponse(true, ['nextStudentId' => $nextId]);

    } elseif ($action === 'upload_photo') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            sendResponse(false, null, 'Method not allowed. Use POST.', 405);
        }

        $rawInput = file_get_contents('php://input');
        $payload  = json_decode($rawInput, true);

        $resData = EnrollmentService::uploadPhoto($payload);
        sendResponse(true, $resData);

    } elseif ($action === 'get_enrollment_stats') {
        $stats = QueueService::getEnrollmentStats($pdo);
        sendResponse(true, $stats);

    } elseif ($action === 'fetch_student_accounts') {
        $students = QueueService::fetchStudentAccounts($pdo);
        sendResponse(true, $students);

    } else {
        sendResponse(false, null, 'Invalid action specified.', 400);
    }

} catch (Exception $e) {
    logAppError('Station API Gateway Error: ' . $e->getMessage(), ['action' => $action]);
    sendResponse(false, null, $e->getMessage(), 500);
}

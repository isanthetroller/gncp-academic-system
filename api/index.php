<?php
/**
 * GNCP Central REST API Engine Router v2.0
 * Unified Gateway with X-Request-ID Tracking & Modular Service Delegation
 */
require_once __DIR__ . '/../shared/backend/utils/logger.php';

$reqId = getRequestId();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Request-ID');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('X-Request-ID: ' . $reqId);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../shared/backend/config/database.php';
require_once __DIR__ . '/../shared/backend/services/BaseStationService.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/StudentController.php';
require_once __DIR__ . '/controllers/StationController.php';
require_once __DIR__ . '/controllers/AdminController.php';

require_once __DIR__ . '/../shared/backend/services/CatalogService.php';
require_once __DIR__ . '/../shared/backend/services/SectionService.php';
require_once __DIR__ . '/../shared/backend/services/RegistrarService.php';

try {
    $pdo = Database::getInstance();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? $_GET['route'] ?? '';
    
    $rawInput = file_get_contents('php://input');
    $payload = !empty($rawInput) ? json_decode($rawInput, true) : [];

    $response = ['success' => false, 'message' => 'Route not found.', 'code' => 404];

    // Auth Routes
    if ($action === 'auth/login' || $action === 'login') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->login($payload);
    } elseif ($action === 'auth/logout' || $action === 'logout') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->logout();
    } elseif ($action === 'auth/check' || $action === 'check_session') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->checkSession();
    } elseif ($action === 'auth/change_password' || $action === 'change_password') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->changePassword($payload);
    } elseif ($action === 'auth/profile' || $action === 'get_profile') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->getProfile();
    } elseif ($action === 'auth/update_profile' || $action === 'update_profile') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->updateProfile($payload);
    } elseif ($action === 'auth/upload_avatar' || $action === 'upload_avatar' || $action === 'stations/upload_photo') {
        $ctrl = new AuthController($pdo);
        $response = $ctrl->uploadAvatar($payload);
    }
    // Student Public Routes
    elseif ($action === 'student/register' || $action === 'register') {
        $ctrl = new StudentController($pdo);
        $response = $ctrl->register($payload);
    } elseif ($action === 'student/track' || $action === 'track') {
        $refNo = $_GET['ref'] ?? $_GET['referenceNumber'] ?? ($payload['referenceNumber'] ?? '');
        $ctrl = new StudentController($pdo);
        $response = $ctrl->track($refNo);
    }
    // Station & Queue Live Operations
    elseif ($action === 'stations/queue' || $action === 'fetch_queue') {
        require_once __DIR__ . '/../stations/backend/services/QueueService.php';
        $etag = QueueService::getQueueHash($pdo);
        header('ETag: ' . $etag);
        header('Cache-Control: no-cache, must-revalidate');

        $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
        if ($ifNoneMatch && (trim($ifNoneMatch) === trim($etag) || trim($ifNoneMatch, '"') === trim($etag, '"'))) {
            http_response_code(304);
            exit;
        }

        $ctrl = new StationController($pdo);
        $response = $ctrl->getQueue();
    } elseif ($action === 'stations/update' || $action === 'update_student') {
        $ctrl = new StationController($pdo);
        $response = $ctrl->updateStudent($payload);
    }
    // Registrar & Domain Operations
    elseif ($action === 'registrar/update_status' || $action === 'update_application_status') {
        $response = RegistrarService::updateApplicationStatus($pdo, $payload);
    } elseif ($action === 'registrar/update_step' || $action === 'update_roadmap_step') {
        $response = RegistrarService::updateRoadmapStep($pdo, $payload);
    } elseif ($action === 'registrar/sections' || $action === 'get_sections_for_program') {
        $prog = $_GET['program'] ?? ($payload['program'] ?? '');
        $year = $_GET['year_level'] ?? ($payload['year_level'] ?? '1st Year');
        $sem  = $_GET['semester']   ?? ($payload['semester']   ?? '1st Semester');
        $response = SectionService::getSectionsForProgram($pdo, $prog, $year, $sem);
    }
    // Admin Operations
    elseif ($action === 'admin/catalog' || $action === 'get_catalog') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->getCatalog();
    } elseif ($action === 'admin/sections' || $action === 'get_sections') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->getSections();
    } elseif ($action === 'admin/terms' || $action === 'get_terms') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->getTerms();
    } elseif ($action === 'admin/users' || $action === 'get_users') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->getUsers();
    } elseif ($action === 'admin/save_program') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->saveProgram($payload);
    } elseif ($action === 'admin/save_subject') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->saveSubject($payload);
    } elseif ($action === 'admin/save_section') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->saveSection($payload);
    } elseif ($action === 'admin/save_term') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->saveTerm($payload);
    } elseif ($action === 'admin/save_user') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->saveUser($payload);
    } elseif ($action === 'admin/cleanup_test_users') {
        $ctrl = new AdminController($pdo);
        $response = $ctrl->cleanupTestUsers($payload);
    }

    $httpCode = $response['code'] ?? ($response['success'] ? 200 : 400);
    http_response_code($httpCode);
    echo json_encode(array_merge($response, ['requestId' => $reqId]), JSON_PRETTY_PRINT);

} catch (Exception $e) {
    logAppError("Central API Error: " . $e->getMessage(), ['action' => $action, 'trace' => $e->getTraceAsString()]);
    http_response_code(500);
    echo json_encode([
        'success'   => false,
        'message'   => 'An unexpected issue occurred while processing your request. Please review your information or try again in a few moments.',
        'requestId' => $reqId,
        'timestamp' => date('c')
    ]);
}

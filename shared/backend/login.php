<?php
/**
 * GNCP Unified Employee Login API Endpoint
 * Handles login authentication for Super Admin, Registrar, and all workstation operators.
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, null, 'Method not allowed. Use POST.', 405);
}

// Parse request payload
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

$username = trim($payload['username'] ?? '');
$password = trim($payload['password'] ?? '');

if (!$username || !$password) {
    sendResponse(false, null, 'Username and password are required.', 400);
}

try {
    $pdo = Database::getInstance();

    // Query station_users table
    $stmt = $pdo->prepare("SELECT * FROM `station_users` WHERE `username` = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    // Validate user existence and password (supports hashed passwords & admin123 fallback)
    $isValidPassword = password_verify($password, $user['password']) || $password === 'admin123';
    if (!$user || !$isValidPassword) {
        sendResponse(false, null, 'Invalid username or password.', 401);
    }

    // Check account status
    if ($user['status'] !== 'ACTIVE') {
        sendResponse(false, null, 'Your account is pending activation. Please contact the Admin.', 403);
    }

    // Determine redirect URL based on role
    $role = $user['role'];
    $redirectUrl = '';

    switch ($role) {
        case 'SUPER_ADMIN':
        case 'ADMIN':
            $redirectUrl = 'admin/index.html';
            break;
        case 'REGISTRAR':
            $redirectUrl = 'registrar/index.html';
            break;
        case 'HELPDESK':
            $redirectUrl = 'stations/tlc-helpdesk/index.html';
            break;
        case 'MEDICAL':
            $redirectUrl = 'stations/medical-checkup/index.html';
            break;
        case 'CASHIER':
            $redirectUrl = 'stations/payment-processing/index.html';
            break;
        case 'IT_CENTER':
            $redirectUrl = 'stations/it-center/index.html';
            break;
        default:
            sendResponse(false, null, 'Unknown employee role: ' . $role, 403);
    }

    // Initialize session and store credentials for printable verification pages
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $sessionUser = json_encode([
        'username' => $user['username'],
        'name'     => $user['name'],
        'role'     => $role
    ]);
    if ($role === 'SUPER_ADMIN' || $role === 'ADMIN') {
        $_SESSION['gncp_admin_user'] = $sessionUser;
    } else {
        $_SESSION['gncp_station_user'] = $sessionUser;
    }

    // Return success response with user profile and redirect details
    sendResponse(true, [
        'username'    => $user['username'],
        'name'        => $user['name'],
        'role'        => $role,
        'redirectUrl' => $redirectUrl
    ], null, 200);

} catch (PDOException $e) {
    error_log("Unified Login API failed: " . $e->getMessage());
    sendResponse(false, null, 'Database connection error occurred.', 500);
}

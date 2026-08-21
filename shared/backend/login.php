<?php
/**
 * GNCP Unified Employee Login API Endpoint
 * Handles login authentication for Super Admin, Registrar, and all workstation operators.
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/utils/response.php';

if (($_GET['action'] ?? '') === 'logout') {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"] ?? '/',
            $params["domain"] ?? '',
            $params["secure"] ?? false,
            $params["httponly"] ?? true
        );
    }
    session_unset();
    session_destroy();
    sendResponse(true, null, 'Logged out successfully.', 200);
}

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

    if (!$user) {
        sendResponse(false, null, 'Invalid username or password.', 401);
    }

    // Strict password verification — no hardcoded backdoors
    $isValidPassword = password_verify($password, $user['password']);
    if (!$isValidPassword) {
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
    $mustChangePassword = (bool)($user['must_change_password'] ?? false);
    $userAvatar = $user['avatar'] ?? $user['photo'] ?? null;
    $sessionUser = [
        'username'             => $user['username'],
        'name'                 => $user['name'],
        'email'                => $user['email'] ?? '',
        'role'                 => $role,
        'avatar'               => $userAvatar,
        'must_change_password' => $mustChangePassword
    ];

    if ($role === 'SUPER_ADMIN' || $role === 'ADMIN') {
        $_SESSION['gncp_admin_user'] = $sessionUser;
        unset($_SESSION['gncp_station_user']);
    } else {
        $_SESSION['gncp_station_user'] = $sessionUser;
        unset($_SESSION['gncp_admin_user']);
    }
    session_write_close();

    // Return success response with user profile and redirect details
    sendResponse(true, [
        'username'             => $user['username'],
        'name'                 => $user['name'],
        'email'                => $user['email'] ?? '',
        'role'                 => $role,
        'must_change_password' => $mustChangePassword,
        'redirectUrl'          => $redirectUrl
    ], null, 200);

} catch (PDOException $e) {
    error_log("Unified Login API failed: " . $e->getMessage());
    sendResponse(false, null, 'Database connection error occurred.', 500);
}

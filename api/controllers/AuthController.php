<?php
/**
 * Auth Controller — Handles user login, logout, forced password changes, and session check
 */
require_once __DIR__ . '/../models/UserModel.php';

class AuthController {
    private $userModel;

    public function __construct($pdo) {
        $this->userModel = new UserModel($pdo);
    }

    public function login($payload) {
        $username = trim($payload['username'] ?? '');
        $password = trim($payload['password'] ?? '');

        if (!$username || !$password) {
            return ['success' => false, 'message' => 'Username and password are required.', 'code' => 400];
        }

        $user = $this->userModel->findByUsername($username);
        if (!$user) {
            return ['success' => false, 'message' => 'Invalid username or password.', 'code' => 401];
        }

        // Strict password verification — no hardcoded backdoors
        $isValidPassword = password_verify($password, $user['password']);
        if (!$isValidPassword) {
            return ['success' => false, 'message' => 'Invalid username or password.', 'code' => 401];
        }

        if (($user['status'] ?? '') !== 'ACTIVE') {
            return ['success' => false, 'message' => 'Your account is pending activation. Please contact the Admin.', 'code' => 403];
        }

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $mustChangePassword = (bool)($user['must_change_password'] ?? false);
        $role = $user['role'];

        // Determine redirect URL based on role (mirrors login.php)
        $redirectUrlMap = [
            'SUPER_ADMIN' => 'admin/index.html',
            'ADMIN'       => 'admin/index.html',
            'REGISTRAR'   => 'registrar/index.html',
            'HELPDESK'    => 'stations/tlc-helpdesk/index.html',
            'MEDICAL'     => 'stations/medical-checkup/index.html',
            'CASHIER'     => 'stations/payment-processing/index.html',
            'IT_CENTER'   => 'stations/it-center/index.html',
        ];
        $redirectUrl = $redirectUrlMap[$role] ?? '';

        // Set session keys matching what all station frontends expect
        $userAvatar = $user['avatar'] ?? $user['photo'] ?? null;
        $sessionPayload = [
            'username'             => $user['username'],
            'name'                 => $user['name'],
            'email'                => $user['email'] ?? '',
            'role'                 => $role,
            'avatar'               => $userAvatar,
            'must_change_password' => $mustChangePassword
        ];
        if ($role === 'SUPER_ADMIN' || $role === 'ADMIN') {
            $_SESSION['gncp_admin_user'] = $sessionPayload;
        } else {
            $_SESSION['gncp_station_user'] = $sessionPayload;
        }

        return [
            'success' => true,
            'data' => [
                'username'             => $user['username'],
                'name'                 => $user['name'],
                'email'                => $user['email'] ?? '',
                'role'                 => $role,
                'avatar'               => $userAvatar,
                'must_change_password' => $mustChangePassword,
                'redirectUrl'          => $redirectUrl
            ],
            'message' => $mustChangePassword ? 'Password change required.' : 'Login successful.'
        ];

    }

    public function changePassword($payload) {
        $username = trim($payload['username'] ?? '');
        $currentPassword = trim($payload['current_password'] ?? '');
        $newPassword = trim($payload['new_password'] ?? '');

        if (!$username || !$currentPassword || !$newPassword) {
            return ['success' => false, 'message' => 'Username, current password, and new password are required.', 'code' => 400];
        }

        if (strlen($newPassword) < 6) {
            return ['success' => false, 'message' => 'New password must be at least 6 characters.', 'code' => 400];
        }

        $user = $this->userModel->findByUsername($username);
        if (!$user) {
            return ['success' => false, 'message' => 'User account not found.', 'code' => 404];
        }

        $isValidPassword = password_verify($currentPassword, $user['password']);
        if (!$isValidPassword) {
            return ['success' => false, 'message' => 'Current password is incorrect.', 'code' => 401];
        }

        $success = $this->userModel->changePassword($username, $newPassword);
        if ($success) {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            $sessionKeys = ['gncp_admin_user', 'gncp_station_user'];
            foreach ($sessionKeys as $key) {
                if (isset($_SESSION[$key])) {
                    $sessionUser = is_string($_SESSION[$key]) ? json_decode($_SESSION[$key], true) : $_SESSION[$key];
                    if (is_array($sessionUser) && ($sessionUser['username'] ?? '') === $username) {
                        $sessionUser['must_change_password'] = false;
                        $_SESSION[$key] = is_string($_SESSION[$key]) ? json_encode($sessionUser) : $sessionUser;
                        break;
                    }
                }
            }

            return ['success' => true, 'message' => 'Password updated successfully. You can now use your new password.'];
        }

        return ['success' => false, 'message' => 'Failed to update password. Please try again.', 'code' => 500];
    }

    public function logout() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        session_unset();
        session_destroy();
        return ['success' => true, 'message' => 'Logged out successfully.'];
    }

    public function checkSession() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $stationSession = $_SESSION['gncp_station_user'] ?? $_SESSION['gncp_admin_user'] ?? null;
        if ($stationSession) {
            $parsed = is_array($stationSession) ? $stationSession : json_decode($stationSession, true);
            if ($parsed) {
                return ['success' => true, 'data' => $parsed];
            }
        }
        return ['success' => false, 'message' => 'No active session.'];
    }

    public function getProfile() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $sessionUser = null;
        $raw = $_SESSION['gncp_station_user'] ?? $_SESSION['gncp_admin_user'] ?? null;
        if ($raw) {
            $sessionUser = is_array($raw) ? $raw : json_decode($raw, true);
        }
        $username = $sessionUser['username'] ?? $_GET['username'] ?? '';
        if (!$username) {
            return ['success' => false, 'message' => 'Unauthorized or missing username.', 'code' => 401];
        }

        $profile = $this->userModel->getProfile($username);
        if (!$profile) {
            return ['success' => false, 'message' => 'User profile not found.', 'code' => 444];
        }

        return ['success' => true, 'data' => $profile];
    }

    public function updateProfile($payload) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $stationUser = $_SESSION['gncp_station_user'] ?? $_SESSION['gncp_admin_user'] ?? null;
        if (is_string($stationUser)) {
            $stationUser = json_decode($stationUser, true);
        }

        $username = $payload['username'] ?? ($stationUser['username'] ?? '');
        if (!$username) {
            return ['success' => false, 'message' => 'Unauthorized or missing username.', 'code' => 401];
        }

        $name   = trim($payload['name'] ?? '');
        $email  = trim($payload['email'] ?? '');
        $avatar = $payload['avatar'] ?? null;

        if (!$name || !$email) {
            return ['success' => false, 'message' => 'Name and email are required fields.', 'code' => 400];
        }

        $success = $this->userModel->updateProfile($username, $name, $email, $avatar);
        if ($success) {
            $sessionKeys = ['gncp_admin_user', 'gncp_station_user'];
            foreach ($sessionKeys as $key) {
                if (isset($_SESSION[$key])) {
                    $sessionUser = is_string($_SESSION[$key]) ? json_decode($_SESSION[$key], true) : $_SESSION[$key];
                    if (is_array($sessionUser) && ($sessionUser['username'] ?? '') === $username) {
                        $sessionUser['name'] = $name;
                        $sessionUser['email'] = $email;
                        if ($avatar !== null) {
                            $sessionUser['avatar'] = $avatar;
                            $sessionUser['photo'] = $avatar;
                        }
                        $_SESSION[$key] = is_string($_SESSION[$key]) ? json_encode($sessionUser) : $sessionUser;
                        break;
                    }
                }
            }
            return ['success' => true, 'message' => 'Profile details updated successfully.'];
        }

        return ['success' => false, 'message' => 'Failed to update profile.', 'code' => 500];
    }

    public function uploadAvatar($payload) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        $sessionUser = $_SESSION['gncp_station_user'] ?? $_SESSION['gncp_admin_user'] ?? $_SESSION['gncp_student_user'] ?? null;
        if (is_string($sessionUser)) {
            $sessionUser = json_decode($sessionUser, true);
        }

        $username = $payload['username'] ?? ($sessionUser['username'] ?? ($sessionUser['id'] ?? ''));
        $base64Data = $payload['photoData'] ?? ($payload['avatarData'] ?? null);

        if (!$username || !$base64Data) {
            return ['success' => false, 'message' => 'Missing username or photo payload.', 'code' => 400];
        }

        // Clean base64 header
        if (strpos($base64Data, ',') !== false) {
            @list(, $base64Data) = explode(',', $base64Data);
        }
        $decoded = base64_decode($base64Data);
        if (!$decoded) {
            return ['success' => false, 'message' => 'Invalid image payload.', 'code' => 400];
        }

        $filename = 'avatar_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $username) . '_' . time() . '.jpg';

        // Target storage directories
        $dir1 = __DIR__ . '/../../shared/assets/uploads';
        $dir2 = __DIR__ . '/../../stations/it-center/assets/uploads';
        $dir3 = __DIR__ . '/../../uploads/avatars';

        if (!is_dir($dir1)) @mkdir($dir1, 0777, true);
        if (!is_dir($dir2)) @mkdir($dir2, 0777, true);
        if (!is_dir($dir3)) @mkdir($dir3, 0777, true);

        @file_put_contents($dir1 . '/' . $filename, $decoded);
        @file_put_contents($dir2 . '/' . $filename, $decoded);
        @file_put_contents($dir3 . '/' . $filename, $decoded);

        // Update database for station_users, students, and pre_enrollments
        $profile = $this->userModel->getProfile($username);
        if ($profile) {
            $name = $profile['name'] ?? $username;
            $email = $profile['email'] ?? ($username . '@gncp.edu.ph');
            $this->userModel->updateProfile($username, $name, $email, $filename);
        }

        return [
            'success' => true,
            'data' => [
                'avatar'   => $filename,
                'photo'    => $filename,
                'user'     => $username
            ],
            'message' => 'Profile picture updated and saved successfully.'
        ];
    }
}

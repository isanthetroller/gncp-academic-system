<?php
/**
 * System Mail & SMTP Configuration
 * Configures Gmail SMTP transport parameters for automated credential dispatches.
 */

$envPass = getenv('GNCP_SMTP_PASS') ?: ($_ENV['GNCP_SMTP_PASS'] ?? 'edhzofxroxclhecy');
$envUser = getenv('GNCP_SMTP_USER') ?: ($_ENV['GNCP_SMTP_USER'] ?? 'goontech1@gmail.com');

return [
    'driver' => 'smtp',
    'host' => getenv('GNCP_SMTP_HOST') ?: ($_ENV['GNCP_SMTP_HOST'] ?? 'smtp.gmail.com'),
    'port' => intval(getenv('GNCP_SMTP_PORT') ?: ($_ENV['GNCP_SMTP_PORT'] ?? 587)),
    'encryption' => 'tls',
    'username' => $envUser,
    'password' => $envPass,
    'from_email' => $envUser,
    'from_name' => 'GNCP Portal Administrator',
    'debug_mode' => true,
];


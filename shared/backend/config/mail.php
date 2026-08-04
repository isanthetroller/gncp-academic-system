<?php
/**
 * System Mail & SMTP Configuration
 * Configures Gmail SMTP transport parameters for automated credential dispatches.
 */

return [
    'driver' => 'smtp',
    'host' => 'smtp.gmail.com',
    'port' => 587,
    'encryption' => 'tls',
    'username' => 'goontech1@gmail.com',
    'password' => 'edhzofxroxclhecy',
    'from_email' => 'goontech1@gmail.com',
    'from_name' => 'GNCP Portal Administrator',
    'debug_mode' => true,
];

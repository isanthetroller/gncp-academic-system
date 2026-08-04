<?php
/**
 * GNCP Academic Portal — Centralized Logger & Request Tracker
 * Logs application errors with X-Request-ID correlation headers to shared/backend/logs/app_errors.log.
 */

function getRequestId() {
    static $requestId = null;
    if ($requestId === null) {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $requestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? $headers['X-Request-ID'] ?? $headers['x-request-id'] ?? null;
        if (!$requestId) {
            $requestId = 'req_' . substr(md5(uniqid(microtime(), true)), 0, 10);
        }
    }
    return $requestId;
}

function logAppError($message, $context = []) {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0777, true);
    }
    $logFile = $logDir . '/app_errors.log';
    
    $reqId = getRequestId();
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | Context: ' . json_encode($context) : '';
    
    $entry = "[{$timestamp}] [{$reqId}] {$message}{$contextStr}" . PHP_EOL;
    @file_put_contents($logFile, $entry, FILE_APPEND);
    error_log("[{$reqId}] {$message}");
}

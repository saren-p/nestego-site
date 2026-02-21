<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$allowedOrigins = [
    'https://nestego.com',
    'https://www.nestego.com',
    'https://saren-p.github.io',
];

if (!empty($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Vary: Origin');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$payload = [];

if (stripos($contentType, 'application/json') !== false && is_string($rawInput) && $rawInput !== '') {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
}

if (!$payload) {
    $payload = $_POST;
}

$name = trim((string)($payload['name'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));
$company = trim((string)($payload['company'] ?? ''));
$phone = trim((string)($payload['phone'] ?? ''));
$companySize = trim((string)($payload['companySize'] ?? ''));
$message = trim((string)($payload['challenge'] ?? $payload['message'] ?? ''));
$turnstileToken = trim((string)($payload['cf-turnstile-response'] ?? ''));

if (mb_strlen($name) < 2) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please provide your name.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please provide a valid email address.']);
    exit;
}

if (preg_match('/[\r\n]/', $email) || preg_match('/[\r\n]/', $name)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input detected.']);
    exit;
}

if (mb_strlen($message) < 10) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please provide more details in your message.']);
    exit;
}

if ($turnstileToken === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please complete the security verification.']);
    exit;
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
$verifyPayload = http_build_query([
    'secret' => 'XXXXX',
    'response' => $turnstileToken,
    'remoteip' => $clientIp,
]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n"
            . 'Content-Length: ' . strlen($verifyPayload) . "\r\n",
        'content' => $verifyPayload,
        'timeout' => 10,
    ],
]);

$verifyResponse = @file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $context);
$verifyData = is_string($verifyResponse) ? json_decode($verifyResponse, true) : null;

if (!is_array($verifyData) || empty($verifyData['success'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Security verification failed. Please try again.']);
    exit;
}

$recipient = 'info@nestego.com';
$subject = 'New website inquiry — ' . $name;
if ($company !== '') {
    $subject .= ' (' . $company . ')';
}

$timestamp = gmdate('Y-m-d H:i:s') . ' UTC';
$referer = $_SERVER['HTTP_REFERER'] ?? 'Unknown';

$bodyLines = [
    'New website inquiry',
    '-------------------',
    'Name: ' . $name,
    'Email: ' . $email,
    'Company: ' . ($company !== '' ? $company : 'N/A'),
    'Phone: ' . ($phone !== '' ? $phone : 'N/A'),
    'Company size: ' . ($companySize !== '' ? $companySize : 'N/A'),
    '',
    'Message:',
    $message,
    '',
    'Timestamp: ' . $timestamp,
    'Referer: ' . $referer,
    'IP: ' . ($clientIp !== '' ? $clientIp : 'Unknown'),
];

$mailBody = implode("\n", $bodyLines);

$headers = [
    'From: Nestego Website <no-reply@nestego.com>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = @mail($recipient, $subject, $mailBody, implode("\r\n", $headers));

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Unable to send your message right now. Please try again later.']);
    exit;
}

echo json_encode(['ok' => true]);

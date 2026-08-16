<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, bool $success, string $message): void
{
    http_response_code($status);
    echo json_encode(
        ['success' => $success, 'message' => $message],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Метод запроса не поддерживается.');
}

$config = require __DIR__ . '/send-config.php';
$smtpPassword = trim((string) ($config['smtp_password'] ?? ''));

if ($smtpPassword === '' || $smtpPassword === 'PASTE_YANDEX_APP_PASSWORD_HERE') {
    respond(500, false, 'На сайте еще не настроен пароль SMTP.');
}

$name = trim((string) ($_POST['name'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$goal = trim((string) ($_POST['goal'] ?? ''));
$comment = trim((string) ($_POST['comment'] ?? ''));

if ($name === '' || $phone === '' || $goal === '') {
    respond(422, false, 'Заполните обязательные поля формы.');
}

if (mb_strlen($name) > 120 || mb_strlen($phone) > 80 || mb_strlen($goal) > 160 || mb_strlen($comment) > 2000) {
    respond(422, false, 'Слишком длинное значение в одном из полей.');
}

$clean = static function (string $value): string {
    return str_replace(["\r", "\n"], ' ', $value);
};

$name = $clean($name);
$phone = $clean($phone);
$goal = $clean($goal);
$comment = $clean($comment);

$from = 'happyfoxyclub@yandex.ru';
$to = 'happyfoxyclub@yandex.ru';
$subject = 'Новая заявка с сайта Happy Foxy';
$body = implode("\r\n", [
    'Новая заявка с сайта Happy Foxy',
    '',
    "Имя: {$name}",
    "Телефон: {$phone}",
    "Интересует: {$goal}",
    'Комментарий: ' . ($comment !== '' ? $comment : 'не указан'),
]);

$socket = @fsockopen('ssl://smtp.yandex.ru', 465, $errorNumber, $errorMessage, 20);
if (!$socket) {
    respond(502, false, 'Не удалось подключиться к SMTP-серверу.');
}

stream_set_timeout($socket, 20);

$readResponse = static function ($socket): string {
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $response;
};

$command = static function ($socket, string $command, array $expectedCodes) use ($readResponse): void {
    fwrite($socket, $command . "\r\n");
    $response = $readResponse($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP error');
    }
};

try {
    $greeting = $readResponse($socket);
    if ((int) substr($greeting, 0, 3) !== 220) {
        throw new RuntimeException('SMTP greeting error');
    }

    $command($socket, 'EHLO happyfoxy.local', [250]);
    $command($socket, 'AUTH LOGIN', [334]);
    $command($socket, base64_encode($from), [334]);
    $command($socket, base64_encode($smtpPassword), [235]);
    $command($socket, "MAIL FROM:<{$from}>", [250]);
    $command($socket, "RCPT TO:<{$to}>", [250, 251]);
    $command($socket, 'DATA', [354]);

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers = [
        "From: Happy Foxy <{$from}>",
        "To: {$to}",
        "Subject: {$encodedSubject}",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n.", "\n..", $body) . "\r\n.";
    fwrite($socket, $message . "\r\n");
    $response = $readResponse($socket);
    if ((int) substr($response, 0, 3) !== 250) {
        throw new RuntimeException('SMTP data error');
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);
} catch (Throwable $error) {
    fclose($socket);
    respond(502, false, 'Почтовый сервер отклонил заявку.');
}

respond(200, true, 'Заявка отправлена.');

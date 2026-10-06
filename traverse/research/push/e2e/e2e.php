<?php
declare(strict_types=1);
/* e2e.php: the server side of the end-to-end test, run by `php -S 127.0.0.1:8790 -t e2e` (see e2e-run.mjs).
 * Keys and state live in the system temp folder, not here: nothing secret lands in the repo.
 *   ?action=key         the VAPID public key (made on first call)
 *   ?action=subscribe   POST {subscription, device}: stored
 *   ?action=send        encrypts a payload and pushes it to every stored subscription through the real push service
 *   ?action=received    POST from the service worker when the push arrives
 *   ?action=state       everything above, for the driver to poll
 *   ?action=reset       start over */
require dirname(__DIR__) . '/webpush.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
$dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webpush-e2e';
if (!is_dir($dir)) mkdir($dir, 0700, true);
$stateFile = "$dir/state.json"; $keyFile = "$dir/vapid.json";
$state = is_file($stateFile) ? (json_decode((string) file_get_contents($stateFile), true) ?: []) : [];
$state += ['subscriptions' => [], 'sent' => [], 'received' => []];
$save = function () use (&$state, $stateFile) { file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT)); };
if (!is_file($keyFile)) { file_put_contents($keyFile, json_encode(vapidKeysGenerate())); chmod($keyFile, 0600); }
$vk = json_decode((string) file_get_contents($keyFile), true);
$vapid = ['publicKey' => $vk['publicKey'], 'privateKey' => $vk['privateKey'], 'subject' => 'mailto:push-test@example.invalid'];
$body = json_decode((string) file_get_contents('php://input'), true) ?: [];
$action = (string) ($_GET['action'] ?? '');

switch ($action) {
    case 'key':
        echo json_encode(['ok' => true, 'publicKey' => $vapid['publicKey']]); break;
    case 'subscribe':
        $sub = $body['subscription'] ?? [];
        if (($why = webpushSubscriptionError($sub)) !== null) { http_response_code(400); echo json_encode(['ok' => false, 'error' => $why]); break; }
        $state['subscriptions'][$sub['endpoint']] = ['subscription' => $sub, 'device' => (string) ($body['device'] ?? ''), 'at' => time()];
        $save(); echo json_encode(['ok' => true, 'count' => count($state['subscriptions'])]); break;
    case 'send':
        $payload = json_encode(['title' => 'Severe Thunderstorm Warning', 'body' => 'Monument until 4:45 PM, hail to 1.5 in (TEST ' . date('H:i:s') . ')',
                                'url' => './#alerts', 'tag' => 'test-' . time(), 'id' => 'e2e-' . bin2hex(random_bytes(4))]);
        $results = [];
        foreach ($state['subscriptions'] as $ep => $row) {
            $r = webpushSend($row['subscription'], empty($_GET['bare']) ? $payload : null, $vapid, 60, ['urgency' => 'high']);
            $results[] = ['endpoint' => substr($ep, 0, 60) . '...', 'result' => $r, 'payloadSent' => empty($_GET['bare']) ? $payload : null];
            if ($r['gone']) unset($state['subscriptions'][$ep]);
        }
        $state['sent'][] = ['at' => time(), 'results' => $results];
        $save(); echo json_encode(['ok' => true, 'results' => $results]); break;
    case 'received':
        $state['received'][] = ['at' => time(), 'data' => $body];
        $save(); echo json_encode(['ok' => true]); break;
    case 'state':
        echo json_encode(['ok' => true, 'subscriptions' => count($state['subscriptions']), 'endpoints' => array_map(fn($e) => substr($e, 0, 48) . '...', array_keys($state['subscriptions'])),
                          'sent' => $state['sent'], 'received' => $state['received']]); break;
    case 'reset':
        $state = ['subscriptions' => [], 'sent' => [], 'received' => []]; $save(); echo json_encode(['ok' => true]); break;
    default:
        http_response_code(404); echo json_encode(['ok' => false, 'error' => 'unknown action']);
}

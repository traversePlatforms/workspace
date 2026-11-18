<?php
/* The Peak email page moved into Outbox (2026-11-17). */
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
http_response_code(410);
echo '{"ok":false,"error":"The Peak email moved into Outbox: /outbox-092b0f/"}';

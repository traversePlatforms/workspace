<?php
declare(strict_types=1);
/**
 * Sixfold Colorado — skip tracing (owner phone lookup) for the door app.  2026-10-04.
 *
 * Included by api/rounds.php (the only thing that calls a provider) and by tools/skip-trace.php
 * (the command-line runner). Nothing in here answers a web request on its own.
 *
 * ---- WHAT THIS IS, AND THE RULE IT LIVES UNDER ------------------------------------------
 * A provider is handed an owner's name, the property address and the owner's mailing address
 * (from the county record) and answers with phone numbers and emails. Every number that comes
 * back is a LOOKED-UP number: calling it to sell is telemarketing. The app's standing rule
 * (rounds.php, "phone numbers", 2026-10-01) is that a looked-up number must clear the national
 * and Colorado Do Not Call lists before anyone dials it. So, here:
 *
 *   - a number the provider marks dnc=true is ON the list: hidden from every call list and
 *     export by default, shown with a "Do Not Call" mark;
 *   - a number the provider returns with NO dnc answer is NOT CLEARED: hidden and marked
 *     "DNC not checked" until it is;
 *   - only a number returned dnc=false counts as cleared and gets a Call link.
 *
 * Nothing here dials, texts, or builds a bulk message. One manual Call link per cleared number.
 *
 * ---- WHERE THE RESULTS LIVE ---------------------------------------------------------------
 * sixfold-data/rounds/skiptrace-<town>.log — one JSON line per door looked up, newest line per
 * door wins (the same append-only shape as phones-<town>.log). Outside public_html, read only
 * through rounds.php by an admin. A door is never sent to the provider twice unless an admin
 * forces a refresh. Errors go to skiptrace-errors.log beside it.
 *
 * ---- SECRETS -------------------------------------------------------------------------------
 * There is no .env on this host. The provider key lives in sixfold-private/skiptrace-config.php
 * beside the other credentials (secrets.php, rounds-codes.php); api/skiptrace-config.example.php
 * is the tracked shape. Environment variables (SIXFOLD_SKIPTRACE_*) override the file, so a
 * .env-style setup works too if one is ever wanted.
 *
 * ---- PROVIDERS -----------------------------------------------------------------------------
 * SkipTraceProvider is the seam: BatchDataProvider is the first adapter; a second provider is a
 * second class and one word in the config. The HTTP transport is a callable, so tests run the
 * real adapter against a scripted response file (see skipMockTransport) and nothing leaves the
 * machine.
 */

/* ======================================================================================= */
/* configuration                                                                            */
/* ======================================================================================= */

function skipConfigDefaults(): array {
    return [
        'provider'         => 'batchdata',
        'endpoint'         => 'https://api.batchdata.com/api/v1/property/skip-trace',
        'api_key'          => '',
        'batch_size'       => 100,     /* records per provider call (BatchData: "up to 100 properties per request") */
        'price_per_record' => null,    /* dollars; null = not set, the dry run says so instead of guessing */
        'min_gap_ms'       => 1000,    /* pause between provider calls */
        'max_retries'      => 4,       /* on 429 / 5xx / network: 1s, 2s, 4s, 8s */
        'timeout'          => 45,      /* seconds per call */
        'mock_file'        => null,    /* tests only: a scripted-response file; no network is touched */
        'crew_see'         => false,   /* looked-up numbers stay admin-only unless this is true */
    ];
}
/** The private file, then environment overrides. $apiDir is the folder holding rounds.php. */
function skipConfig(?string $apiDir = null): array {
    $apiDir = $apiDir ?? __DIR__;
    $cfg = skipConfigDefaults();
    $priv = dirname($apiDir, 2) . '/sixfold-private/skiptrace-config.php';
    if (is_readable($priv)) $cfg = array_replace($cfg, (array) (require $priv));
    $env = ['provider' => 'SIXFOLD_SKIPTRACE_PROVIDER', 'endpoint' => 'SIXFOLD_SKIPTRACE_ENDPOINT', 'api_key' => 'SIXFOLD_SKIPTRACE_KEY',
            'batch_size' => 'SIXFOLD_SKIPTRACE_BATCH', 'price_per_record' => 'SIXFOLD_SKIPTRACE_PRICE', 'mock_file' => 'SIXFOLD_SKIPTRACE_MOCK',
            'min_gap_ms' => 'SIXFOLD_SKIPTRACE_GAP_MS', 'max_retries' => 'SIXFOLD_SKIPTRACE_RETRIES'];
    foreach ($env as $k => $name) { $v = getenv($name); if ($v !== false && $v !== '') $cfg[$k] = $v; }
    $cfg['batch_size'] = max(1, min(100, (int) $cfg['batch_size']));
    $cfg['max_retries'] = max(0, min(8, (int) $cfg['max_retries']));
    $cfg['min_gap_ms'] = max(0, (int) $cfg['min_gap_ms']);
    $cfg['price_per_record'] = ($cfg['price_per_record'] === null || $cfg['price_per_record'] === '') ? null : (float) $cfg['price_per_record'];
    $cfg['api_key'] = trim((string) $cfg['api_key']);
    if ($cfg['api_key'] === 'PASTE-YOUR-BATCHDATA-API-KEY-HERE') $cfg['api_key'] = '';
    /* the scripted test responses only ever answer on the test server or the command line, never on the live web
       server (2026-10-04 review): a stray setting there must not swap real lookups for a file */
    if (!in_array(PHP_SAPI, ['cli', 'cli-server'], true)) $cfg['mock_file'] = null;
    return $cfg;
}
/** Ready to call a provider? The mock needs no key. */
function skipConfigured(array $cfg): bool { return !empty($cfg['mock_file']) || $cfg['api_key'] !== ''; }

/* ======================================================================================= */
/* who the owner is                                                                         */
/* ======================================================================================= */

/* The same classes as the mailing-list builder (operations/door-territory/build-mail-list.mjs).
   Order matters: "SMITH FAMILY TRUST" is a trust, "TRUST COMPANY OF AMERICA" is a company. */
const SKIP_OWNER_KINDS = [
    ['company',    '/\b(BANK|NATIONAL ASSOCIATION|SAVINGS|CREDIT UNION|FEDERAL HOME LOAN|FANNIE MAE|FREDDIE MAC)\b/'],
    ['government', '/\b(TOWN OF|CITY OF|COUNTY OF|COUNTY|STATE OF|STATE BOARD|UNITED STATES|USA\b|BOARD OF|SCHOOL DIST|SCHOOL DISTRICT|WATER (AND|&) SANITATION|SANITATION DIST|FIRE (PROTECTION )?DIST|WATER DIST|HEALTH SERVICE DISTRICT|LIBRARY|HOUSING AUTHORITY|DEPT OF|DEPARTMENT OF|REGIONAL BUILDING)\b/'],
    ['community',  '/\b(HOMEOWNERS?|HOME OWNERS?|OWNERS ASS|OWNERS ASSN|PROPERTY OWNERS|ASSOCIATION|ASSN|HOA|POA|METROPOLITAN DIST|METRO DIST|MASTER ASSOC|COMMUNITY ASSOC|CIVIC ASSOC|IMPROVEMENT ASSOC|LAKE ASSOC)\b/'],
    ['nonprofit',  '/\b(CHURCH|PARISH|MINISTR|DIOCESE|CONGREGATION|BIBLE|FELLOWSHIP|TEMPLE|FOUNDATION|SOCIETY|CAMP|SCOUTS|YMCA|CONSERVANCY|LAND TRUST)\b/'],
    ['trust',      '/\b(TRUST|TRUSTEE|TRUSTEES|TR|LIVING TR|REV TR|REVOCABLE|IRREVOCABLE|ESTATE OF)\b/'],
    ['company',    '/\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|LLP|LTD|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|INVESTMENTS?|ENTERPRISES|VENTURES|GROUP|CAPITAL|REALTY|HOMES|BUILDERS|DEVELOPMENT|MANAGEMENT|RENTALS?|BANK|MORTGAGE|FUND)\b/'],
];
const SKIP_KIND_LABEL = ['noowner' => 'no owner on the record', 'company' => 'company / LLC', 'government' => 'government', 'community' => 'HOA / district',
                         'nonprofit' => 'church / nonprofit', 'trust' => 'trust / estate'];
/** null for a person; otherwise why the door is not sent. */
function skipOwnerKind(?string $owner): ?string {
    $o = trim((string) $owner);
    if ($o === '' || preg_match('/^unavailable$/i', $o)) return 'noowner';
    $n = ' ' . preg_replace('/[^A-Z0-9& ]/', ' ', strtoupper($o)) . ' ';
    foreach (SKIP_OWNER_KINDS as [$kind, $re]) if (preg_match($re, $n)) return $kind;
    return null;
}

/* County records write names three ways: El Paso "LAST FIRST M / LAST FIRST" (Monument, Palmer
   Lake, Black Forest), Douglas "FIRST M LAST & FIRST LAST" (Castle Rock, Larkspur, Sedalia,
   Franktown), Teller "LAST, FIRST & FIRST M" (Woodland Park, Divide, Florissant, Cripple Creek).
   The first person named is sent; the provider matches on the address first and the name second. */
const SKIP_NAME_ORDER = ['monument' => 'last-first', 'palmer-lake' => 'last-first', 'black-forest' => 'last-first',
                         'castle-rock' => 'first-last', 'larkspur' => 'first-last', 'sedalia' => 'first-last', 'franktown' => 'first-last',
                         'woodland-park' => 'comma', 'divide' => 'comma', 'florissant' => 'comma', 'cripple-creek' => 'comma'];
const SKIP_NOT_A_NAME = ['JR', 'SR', 'II', 'III', 'IV', 'MR', 'MRS', 'MS', 'DR', 'ET', 'AL', 'UX', 'JT', 'TEN', 'AND', 'THE'];
/** ['first' => ..., 'last' => ...] or null when nothing name-like is there. */
function skipNameParts(string $owner, string $town = ''): ?array {
    $first = preg_split('/\s+(?:\/|&|AND)\s+/i', trim($owner))[0] ?? '';
    $first = trim($first);
    if ($first === '') return null;
    $order = SKIP_NAME_ORDER[$town] ?? (str_contains($first, ',') ? 'comma' : 'last-first');
    if (str_contains($first, ',')) $order = 'comma';
    $tok = fn(string $s): array => array_values(array_filter(preg_split('/\s+/', strtoupper(preg_replace('/[^A-Za-z\' -]/', ' ', $s))) ?: [],
                                                             fn($t) => $t !== '' && !in_array($t, SKIP_NOT_A_NAME, true)));
    if ($order === 'comma') {
        [$l, $f] = array_pad(explode(',', $first, 2), 2, '');
        $lt = $tok($l); $ft = $tok($f);
        if (!$lt || !$ft) return null;
        return ['first' => ucfirst(strtolower($ft[0])), 'last' => ucwords(strtolower(implode(' ', $lt)))];
    }
    $t = $tok($first);
    if (count($t) < 2) return null;
    if ($order === 'first-last') return ['first' => ucfirst(strtolower($t[0])), 'last' => ucfirst(strtolower($t[count($t) - 1]))];
    return ['first' => ucfirst(strtolower($t[1])), 'last' => ucfirst(strtolower($t[0]))];   /* last-first */
}

/** "134 1/2 HIGH ST, PALMER LAKE, CO, 80133-5068" -> parts, or null if it does not read as a US address. */
function skipAddressParts(string $s): ?array {
    /* Douglas County writes ZIP+4 with no hyphen ("801099539"); El Paso writes "80133-5068" */
    if (!preg_match('/^(.*?),\s*([^,]+?),\s*([A-Z]{2}),?\s*(\d{5})(?:-?\d{4})?\s*$/i', trim($s), $m)) return null;
    return ['street' => trim($m[1]), 'city' => trim($m[2]), 'state' => strtoupper($m[3]), 'zip' => $m[4]];
}
function skipDigits(string $n): string {
    $d = preg_replace('/\D/', '', $n) ?? '';
    if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1);
    return $d;
}
/** The one rule for a Call link: cleared means the provider said dnc=false. Nothing else does. */
function skipCleared(array $phone): bool { return ($phone['dnc'] ?? null) === false; }
function skipDncLabel(array $phone): string { return ($phone['dnc'] ?? null) === true ? 'listed' : (($phone['dnc'] ?? null) === false ? 'clear' : 'unchecked'); }

/* ======================================================================================= */
/* providers                                                                                */
/* ======================================================================================= */

interface SkipTraceProvider {
    public function name(): string;
    public function batchSize(): int;
    /**
     * @param array $records  list of ['ref' => string, 'owner' => string, 'name' => ?['first','last'],
     *                        'address' => ['street','city','state','zip'], 'mail' => ?['street','city','state','zip']]
     * @return array ['ok' => bool, 'status' => int, 'retry' => bool, 'error' => ?string, 'retryAfter' => ?int,
     *                'results' => [ref => ['status' => 'matched'|'nomatch', 'phones' => [...], 'emails' => [...], 'conf' => ?float, 'raw' => ?array]]]
     *         phones: ['n' => 10 digits, 'type' => 'mobile'|'landline'|'voip'|null, 'dnc' => true|false|null, 'tcpa' => ?bool, 'score' => ?int, 'reachable' => ?bool]
     */
    public function trace(array $records): array;
}

/**
 * BatchData, property skip trace.
 *
 * Confirmed from BatchData's own pages (batchdata.io, 2026-10-04): base URL https://api.batchdata.com/api/v1,
 * POST /property/skip-trace, "Authorization: Bearer <token>", Content-Type application/json, up to 100
 * properties per request, request fields named propertyAddress / mailingAddress / name, DNC and TCPA
 * flags carried in the response, an /async variant with a webhook.
 * ASSUMED (the developer portal renders only in a browser): the exact nesting of the response —
 * results.persons[] with phoneNumbers[] {number, type, dnc, tcpa, reachable, score} and emails[] {email},
 * and that a person echoes the propertyAddress it matched. The parser below accepts several spellings
 * and keeps the raw person on each row, so a different shape costs a re-parse, not a second purchase.
 */
final class BatchDataProvider implements SkipTraceProvider {
    /** @var callable(string $url, array $headers, string $body): array{status:int, body:string, headers:array} */
    private $http;
    public function __construct(private array $cfg, ?callable $http = null) {
        $this->http = $http ?? skipHttpTransport((int) ($cfg['timeout'] ?? 45));
    }
    public function name(): string { return 'batchdata'; }
    public function batchSize(): int { return (int) $this->cfg['batch_size']; }

    public function request(array $records): array {
        $reqs = [];
        foreach ($records as $r) {
            $one = ['propertyAddress' => array_filter($r['address'], fn($v) => $v !== null && $v !== '')];
            if (!empty($r['mail'])) $one['mailingAddress'] = array_filter($r['mail'], fn($v) => $v !== null && $v !== '');
            if (!empty($r['name'])) $one['name'] = $r['name'];
            $reqs[] = $one;
        }
        return ['requests' => $reqs];
    }

    public function trace(array $records): array {
        $body = json_encode($this->request($records), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers = ['Authorization: Bearer ' . $this->cfg['api_key'], 'Content-Type: application/json', 'Accept: application/json'];
        try {
            $res = ($this->http)((string) $this->cfg['endpoint'], $headers, (string) $body);
        } catch (Throwable $e) {
            return ['ok' => false, 'status' => 0, 'retry' => true, 'error' => 'network: ' . $e->getMessage(), 'retryAfter' => null, 'results' => []];
        }
        $status = (int) ($res['status'] ?? 0);
        $retryAfter = null;
        foreach (($res['headers'] ?? []) as $h) if (preg_match('/^retry-after:\s*(\d+)/i', (string) $h, $m)) $retryAfter = (int) $m[1];
        if ($status === 429 || $status >= 500 || $status === 0) {
            return ['ok' => false, 'status' => $status, 'retry' => true, 'error' => 'HTTP ' . $status . ($status === 429 ? ' (rate limited)' : ''), 'retryAfter' => $retryAfter, 'results' => []];
        }
        if ($status === 401 || $status === 403) return ['ok' => false, 'status' => $status, 'retry' => false, 'error' => 'HTTP ' . $status . ': the API key was refused', 'retryAfter' => null, 'results' => []];
        $j = json_decode((string) ($res['body'] ?? ''), true);
        if ($status !== 200 || !is_array($j)) {
            $snippet = substr(preg_replace('/\s+/', ' ', (string) ($res['body'] ?? '')) ?? '', 0, 200);
            return ['ok' => false, 'status' => $status, 'retry' => false, 'error' => 'HTTP ' . $status . ': ' . ($snippet !== '' ? $snippet : 'no readable answer'), 'retryAfter' => null, 'results' => []];
        }
        return ['ok' => true, 'status' => 200, 'retry' => false, 'error' => null, 'retryAfter' => null, 'results' => $this->parse($j, $records)];
    }

    /** Persons back to the records they answer: by the echoed property street, then by position. */
    public function parse(array $j, array $records): array {
        $persons = $j['results']['persons'] ?? $j['persons'] ?? $j['results'] ?? [];
        if (!is_array($persons)) $persons = [];
        $persons = array_values(array_filter($persons, 'is_array'));
        $norm = fn(string $s): string => preg_replace('/[^A-Z0-9]/', '', strtoupper($s)) ?? '';
        $byStreet = [];
        foreach ($records as $i => $r) $byStreet[$norm((string) ($r['address']['street'] ?? ''))][] = $i;
        $out = [];
        foreach ($records as $r) $out[$r['ref']] = ['status' => 'nomatch', 'phones' => [], 'emails' => [], 'conf' => null, 'raw' => null];
        $taken = [];
        foreach ($persons as $k => $p) {
            $street = (string) ($p['propertyAddress']['street'] ?? $p['propertyAddress']['address'] ?? $p['request']['propertyAddress']['street'] ?? $p['address']['street'] ?? '');
            $idx = null;
            if ($street !== '' && !empty($byStreet[$norm($street)])) foreach ($byStreet[$norm($street)] as $cand) if (!isset($taken[$cand])) { $idx = $cand; break; }
            if ($idx === null && isset($p['meta']['requestIndex']) && isset($records[(int) $p['meta']['requestIndex']])) $idx = (int) $p['meta']['requestIndex'];
            if ($idx === null && $street === '' && count($persons) === count($records) && isset($records[$k]) && !isset($taken[$k])) $idx = $k;
            if ($idx === null) continue;
            $taken[$idx] = true;
            $ref = $records[$idx]['ref'];
            $phones = [];
            foreach ((array) ($p['phoneNumbers'] ?? $p['phones'] ?? []) as $ph) {
                if (is_string($ph)) $ph = ['number' => $ph];
                if (!is_array($ph)) continue;
                $n = skipDigits((string) ($ph['number'] ?? $ph['phone'] ?? ''));
                if (!preg_match('/^[2-9]\d{2}[2-9]\d{6}$/D', $n)) continue;
                $type = strtolower((string) ($ph['type'] ?? $ph['phoneType'] ?? ''));
                $type = in_array($type, ['mobile', 'landline', 'voip'], true) ? $type : ($type === 'wireless' || $type === 'cell' ? 'mobile' : null);
                $dnc = $ph['dnc'] ?? $ph['dncStatus'] ?? $ph['isDnc'] ?? $ph['doNotCall'] ?? null;
                $dnc = is_bool($dnc) ? $dnc : (is_string($dnc) && in_array(strtolower($dnc), ['true', 'yes', 'y', '1'], true) ? true : (is_string($dnc) && in_array(strtolower($dnc), ['false', 'no', 'n', '0'], true) ? false : null));
                $tcpa = $ph['tcpa'] ?? $ph['tcpaLitigator'] ?? null;
                $phones[] = ['n' => $n, 'type' => $type, 'dnc' => $dnc, 'tcpa' => is_bool($tcpa) ? $tcpa : null,
                             'score' => isset($ph['score']) && is_numeric($ph['score']) ? (int) $ph['score'] : null,
                             'reachable' => is_bool($ph['reachable'] ?? null) ? $ph['reachable'] : null];
            }
            /* one line per number: the same number listed twice (two persons, mobile and "wireless") keeps the stricter dnc */
            $seen = [];
            foreach ($phones as $ph) {
                if (isset($seen[$ph['n']])) { if ($ph['dnc'] === true || ($ph['dnc'] === null && $seen[$ph['n']]['dnc'] === false)) $seen[$ph['n']]['dnc'] = $ph['dnc'] === true ? true : null; continue; }
                $seen[$ph['n']] = $ph;
            }
            $emails = [];
            foreach ((array) ($p['emails'] ?? []) as $em) {
                $e = is_array($em) ? (string) ($em['email'] ?? $em['address'] ?? '') : (string) $em;
                $e = strtolower(trim($e));
                if ($e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL) && !in_array($e, $emails, true)) $emails[] = $e;
            }
            $conf = $p['meta']['matchScore'] ?? $p['matchScore'] ?? $p['confidence'] ?? $p['score'] ?? null;
            $cur = $out[$ref];
            $cur['status'] = 'matched';
            $cur['phones'] = array_values(array_merge($cur['phones'], array_values($seen)));
            $cur['emails'] = array_values(array_unique(array_merge($cur['emails'], $emails)));
            $cur['conf'] = is_numeric($conf) ? (float) $conf : $cur['conf'];
            $cur['raw'] = $cur['raw'] === null ? $p : $cur['raw'];   /* the first person, for a re-parse */
            $out[$ref] = $cur;
        }
        return $out;
    }
}

/** The provider named in the config. A second provider is a second class and one word here. */
function skipProvider(array $cfg, ?callable $http = null): SkipTraceProvider {
    if ($http === null && !empty($cfg['mock_file'])) $http = skipMockTransport((string) $cfg['mock_file']);
    return match ((string) $cfg['provider']) {
        'batchdata' => new BatchDataProvider($cfg, $http),
        default => throw new RuntimeException('Unknown skip trace provider: ' . $cfg['provider']),
    };
}

/** Real HTTP. cURL when the host has it, PHP streams otherwise (the test server has no curl). */
function skipHttpTransport(int $timeout): callable {
    return function (string $url, array $headers, string $body) use ($timeout): array {
        if (!preg_match('#^https://#i', $url)) throw new RuntimeException('the endpoint must be https');
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            $hdrs = [];
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true,
                                    CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 15,
                                    CURLOPT_HEADERFUNCTION => function ($c, $h) use (&$hdrs) { $hdrs[] = trim($h); return strlen($h); }]);
            $out = curl_exec($ch);
            if ($out === false) { $err = curl_error($ch); curl_close($ch); throw new RuntimeException($err ?: 'curl failed'); }
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
            return ['status' => $status, 'body' => (string) $out, 'headers' => $hdrs];
        }
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => $timeout, 'ignore_errors' => true]]);
        $out = @file_get_contents($url, false, $ctx);
        if ($out === false) throw new RuntimeException('no answer from ' . parse_url($url, PHP_URL_HOST));
        $hdrs = $http_response_header ?? [];
        $status = 0; if ($hdrs && preg_match('#^HTTP/\S+\s+(\d{3})#', $hdrs[0], $m)) $status = (int) $m[1];
        return ['status' => $status, 'body' => (string) $out, 'headers' => $hdrs];
    };
}

/**
 * Tests only. The file is a JSON list of steps, used one per call (the last repeats):
 *   {"status": 429, "retry_after": 2}                       rate limited
 *   {"status": 500}                                          server error
 *   {"fail": "network"}                                      the connection drops
 *   {"status": 200, "match": {"2755 MOUNT HERMAN RD": {"phones": [{"number": "7195550101", "type": "Mobile", "dnc": false}],
 *                                                       "emails": ["a@example.com"]}}}
 * A 200 step answers in BatchData's shape for every request whose street is in "match" and leaves the
 * rest unmatched, so the real parser runs. Every request body is written to <file>.requests.log so a
 * test can check what would have been sent. <file>.cursor remembers the step.
 */
function skipMockTransport(string $file): callable {
    return function (string $url, array $headers, string $body) use ($file): array {
        $steps = json_decode((string) @file_get_contents($file), true);
        if (!is_array($steps) || !$steps) throw new RuntimeException('mock file unreadable: ' . $file);
        $cur = (int) @file_get_contents($file . '.cursor');
        $step = $steps[min($cur, count($steps) - 1)];
        @file_put_contents($file . '.cursor', (string) ($cur + 1));
        @file_put_contents($file . '.requests.log', json_encode(['url' => $url, 'auth' => (bool) array_filter($headers, fn($h) => str_starts_with($h, 'Authorization: Bearer ')), 'body' => json_decode($body, true)]) . "\n", FILE_APPEND);
        if (($step['fail'] ?? '') === 'network') throw new RuntimeException('connection reset (mock)');
        $status = (int) ($step['status'] ?? 200);
        $hdrs = isset($step['retry_after']) ? ['Retry-After: ' . (int) $step['retry_after']] : [];
        if ($status !== 200) return ['status' => $status, 'body' => json_encode(['status' => ['code' => $status, 'text' => 'mock']]), 'headers' => $hdrs];
        $req = json_decode($body, true)['requests'] ?? [];
        $persons = [];
        foreach ($req as $r) {
            $street = (string) ($r['propertyAddress']['street'] ?? '');
            $m = $step['match'][$street] ?? null;
            if (!$m) continue;
            $persons[] = ['name' => $r['name'] ?? ['first' => '', 'last' => ''], 'propertyAddress' => $r['propertyAddress'],
                          'phoneNumbers' => array_map(fn($p) => ['number' => $p['number'], 'type' => $p['type'] ?? 'Mobile', 'carrier' => 'Mock Wireless',
                                                                 'tested' => true, 'reachable' => $p['reachable'] ?? true, 'score' => $p['score'] ?? 90] + (array_key_exists('dnc', $p) ? ['dnc' => $p['dnc']] : []) + (isset($p['tcpa']) ? ['tcpa' => $p['tcpa']] : []), $m['phones'] ?? []),
                          'emails' => array_map(fn($e) => ['email' => $e, 'tested' => true], $m['emails'] ?? []),
                          'meta' => ['matchScore' => $m['score'] ?? 0.95]];
        }
        $out = ['status' => ['code' => 200, 'text' => 'OK'], 'results' => ['persons' => $persons,
                'meta' => ['results' => ['requestCount' => count($req), 'matchCount' => count($persons), 'noMatchCount' => count($req) - count($persons)]]]];
        return ['status' => 200, 'body' => json_encode($out), 'headers' => []];
    };
}

/* ======================================================================================= */
/* the run: batches, back-off, one row per door                                             */
/* ======================================================================================= */

/**
 * Sends $records in provider-sized batches. A batch that fails after the retries is written as
 * 'error' rows and the run goes on. Returns the rows to append (one per record, in order).
 * $emit(string $line) gets progress and error text; $sleep(float $seconds) is injectable for tests.
 */
function skipRun(array $records, SkipTraceProvider $p, array $cfg, callable $emit, ?callable $sleep = null, string $by = ''): array {
    $sleep = $sleep ?? fn(float $s) => usleep((int) round($s * 1e6));
    $rows = []; $first = true;
    foreach (array_chunk(array_values($records), max(1, $p->batchSize())) as $chunk) {
        if (!$first && $cfg['min_gap_ms'] > 0) $sleep($cfg['min_gap_ms'] / 1000);
        $first = false;
        $res = null;
        for ($attempt = 0; ; $attempt++) {
            $res = $p->trace($chunk);
            if ($res['ok'] || !$res['retry'] || $attempt >= (int) $cfg['max_retries']) break;
            $wait = $res['retryAfter'] !== null ? min(60, max(1, (int) $res['retryAfter'])) : min(60, 2 ** $attempt);
            $emit('retry ' . ($attempt + 1) . '/' . $cfg['max_retries'] . ' after ' . $res['error'] . ': waiting ' . $wait . 's');
            $sleep((float) $wait);
        }
        $at = time();
        if (!$res['ok']) {
            $emit('batch of ' . count($chunk) . ' failed: ' . $res['error']);
            foreach ($chunk as $r) $rows[] = ['id' => $r['ref'], 'at' => $at, 'prov' => $p->name(), 'status' => 'error', 'err' => (string) $res['error'],
                                               'phones' => [], 'emails' => [], 'conf' => null, 'in' => skipInputSummary($r), 'by' => $by];
            continue;
        }
        $n = 0;
        foreach ($chunk as $r) {
            $x = $res['results'][$r['ref']] ?? ['status' => 'nomatch', 'phones' => [], 'emails' => [], 'conf' => null, 'raw' => null];
            if ($x['status'] === 'matched') $n++;
            $rows[] = ['id' => $r['ref'], 'at' => $at, 'prov' => $p->name(), 'status' => $x['status'], 'phones' => $x['phones'], 'emails' => $x['emails'],
                       'conf' => $x['conf'], 'in' => skipInputSummary($r), 'by' => $by] + ($x['raw'] !== null ? ['raw' => $x['raw']] : []);
        }
        $emit('batch of ' . count($chunk) . ': ' . $n . ' matched');
    }
    return $rows;
}
function skipInputSummary(array $r): array {
    $line = fn(?array $a) => $a ? trim(implode(', ', array_filter([$a['street'] ?? '', $a['city'] ?? '', trim(($a['state'] ?? '') . ' ' . ($a['zip'] ?? ''))]))) : '';
    return ['owner' => (string) $r['owner'], 'addr' => $line($r['address']), 'mail' => $line($r['mail'] ?? null)];
}

/* ======================================================================================= */
/* the door data side (needs rounds.php loaded: DATA_DIR, logRows, loadRegion, appendLine)   */
/* ======================================================================================= */

function skipFile(string $key): string { return DATA_DIR . '/skiptrace-' . $key . '.log'; }
function skipErrFile(): string { return DATA_DIR . '/skiptrace-errors.log'; }
/** Replay: newest line per door wins. */
function skipLoad(string $key): array {
    $out = [];
    foreach (logRows('skiptrace', $key) as $r) if (is_array($r) && isset($r['id'], $r['status'])) $out[$r['id']] = $r;
    return $out;
}
function skipAppend(string $key, array $row): bool { return appendLine(skipFile($key), stamped($row)); }
function skipErr(string $town, string $msg): void { @appendLine(skipErrFile(), ['at' => time(), 'town' => $town, 'error' => $msg]); }

/** mail-<town>.json beside the door file: id => {m: owner's mailing address, c: property city, z: property ZIP}.
    Built offline by operations/door-territory/build-mail-sidecar.mjs from the county CSVs; the door
    files themselves carry no mailing address and no ZIP. Missing file = send what the door has. */
function skipMail(string $key): array {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/mail-' . $key . '.json'), true);
    return is_array($j) ? $j : [];
}

/**
 * Which doors would go, and which would not. $area '' = the whole town, in the town's own order.
 * Cached (already matched / no match / skipped) doors are left out unless $force; errors are retried.
 */
function skipCandidates(string $key, string $area, int $limit, bool $force, string $townLabel, int $since = 0): array {
    $data = loadRegion($key) ?: ['areas' => []];
    $done = skipLoad($key); $mail = skipMail($key);
    $send = []; $skipped = []; $skipRows = []; $cached = 0; $total = 0; $errorsRetried = 0;
    foreach ($data['areas'] as $a) {
        if ($area !== '' && $a['name'] !== $area) continue;
        foreach ($a['doors'] as $d) {
            $total++;
            $prev = $done[$d['id']] ?? null;
            if ($prev && !$force && $prev['status'] !== 'error') { $cached++; continue; }
            /* a forced run that goes a chunk at a time: what this run already did is not done again */
            if ($prev && $force && $since > 0 && (int) ($prev['at'] ?? 0) >= $since) { $cached++; continue; }
            if ($prev && $prev['status'] === 'error') $errorsRetried++;
            /* the owners that are not people are flagged whatever the limit: the limit is on what is SENT */
            $kind = skipOwnerKind($d['owner'] ?? '');
            if ($kind !== null) {
                $skipped[$kind] = ($skipped[$kind] ?? 0) + 1;
                if (!$prev || $force) $skipRows[] = ['id' => $d['id'], 'at' => time(), 'prov' => '', 'status' => 'skipped', 'why' => $kind, 'phones' => [], 'emails' => [], 'conf' => null,
                                                      'in' => ['owner' => (string) ($d['owner'] ?? ''), 'addr' => $d['address'], 'mail' => '']];
                continue;
            }
            if (count($send) >= $limit) continue;
            $side = $mail[$d['id']] ?? [];
            $mailParts = isset($side['m']) ? skipAddressParts((string) $side['m']) : null;
            $send[] = ['ref' => $d['id'], 'owner' => (string) $d['owner'], 'name' => skipNameParts((string) $d['owner'], $key),
                       'address' => ['street' => (string) $d['address'], 'city' => (string) ($side['c'] ?? $townLabel), 'state' => 'CO', 'zip' => (string) ($side['z'] ?? '')],
                       'mail' => $mailParts, 'area' => $a['name']];
        }
    }
    return ['send' => $send, 'skipped' => $skipped, 'skipRows' => $skipRows, 'cached' => $cached, 'total' => $total, 'errorsRetried' => $errorsRetried,
            'withMail' => count(array_filter($send, fn($r) => $r['mail'] !== null))];
}

/** What the page may see of a result row. Every number carries its dnc answer and whether it is cleared. */
function skipPublic(array $row, bool $withRaw = false): array {
    $phones = array_map(fn($p) => ['n' => $p['n'], 'type' => $p['type'] ?? null, 'dnc' => skipDncLabel($p), 'clear' => skipCleared($p), 'tcpa' => $p['tcpa'] ?? null], $row['phones'] ?? []);
    $out = ['status' => $row['status'], 'at' => (int) ($row['at'] ?? 0), 'prov' => (string) ($row['prov'] ?? ''), 'phones' => $phones, 'emails' => array_values($row['emails'] ?? []),
            'conf' => $row['conf'] ?? null, 'why' => $row['why'] ?? null, 'err' => $row['err'] ?? null, 'by' => $row['by'] ?? '',
            'clear' => count(array_filter($phones, fn($p) => $p['clear'])), 'listed' => count(array_filter($phones, fn($p) => $p['dnc'] === 'listed')),
            'unchecked' => count(array_filter($phones, fn($p) => $p['dnc'] === 'unchecked'))];
    if ($withRaw) $out['raw'] = $row['raw'] ?? null;
    return $out;
}

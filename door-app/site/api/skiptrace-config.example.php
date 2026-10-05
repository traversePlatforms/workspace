<?php
/**
 * Template for sixfold-private/skiptrace-config.php — copy it, fill it in, never commit the copy.
 *
 * ⚑ WHERE IT GOES: `sixfold-private/skiptrace-config.php`, the folder BESIDE public_html (the same
 *   level as sixfold-data/ and the other credentials, secrets.php and rounds-codes.php). Never inside
 *   public_html: a .php file there is protected only by PHP executing it. make-bundle.mjs refuses to
 *   ship either this example or the real file.
 *
 * This site has no .env. The same keys can be set as environment variables instead, and they win
 * over this file: SIXFOLD_SKIPTRACE_PROVIDER, SIXFOLD_SKIPTRACE_ENDPOINT, SIXFOLD_SKIPTRACE_KEY,
 * SIXFOLD_SKIPTRACE_BATCH, SIXFOLD_SKIPTRACE_PRICE, SIXFOLD_SKIPTRACE_GAP_MS, SIXFOLD_SKIPTRACE_RETRIES.
 *
 * Every number a provider returns is a LOOKED-UP number (see api/skiptrace.php): it is hidden from
 * call lists and exports until the provider says it is not on the Do Not Call list.
 */
return [
    // The adapter to use. 'batchdata' is the only one built so far (api/skiptrace.php, BatchDataProvider).
    'provider'         => 'batchdata',

    // BatchData, property skip trace (v1). Change only if BatchData moves it.
    'endpoint'         => 'https://api.batchdata.com/api/v1/property/skip-trace',

    // From app.batchdata.com -> API -> keys. Shown once; paste it here.
    'api_key'          => 'PASTE-YOUR-BATCHDATA-API-KEY-HERE',

    // Records per call. BatchData accepts up to 100 properties per request.
    'batch_size'       => 100,

    // What one record costs, in dollars, for the dry run's estimate. Take it from the BatchData plan
    // page for the account; nothing here guesses it. Leave null and the dry run says "price not set".
    'price_per_record' => null,

    // Pause between calls (milliseconds), and how many times to retry a 429 / 5xx / dropped connection
    // (1s, 2s, 4s, 8s, or the provider's Retry-After).
    'min_gap_ms'       => 1000,
    'max_retries'      => 4,

    // Looked-up numbers are admin-only in the app. true lets the crew see a door's cleared numbers too.
    'crew_see'         => false,
];

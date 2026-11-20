<?php
/* site-analytics/config.php on the server (0600). The real files are written straight to the server from ~/.ssh (see lib.php) and never sit in the repo.
   traverseplatforms.com: */
return [
    'site' => 'traverse', 'label' => 'Traverse', 'hosts' => ['traverseplatforms.com', 'www.traverseplatforms.com'], 'tz' => 'America/Denver',
    /* what counts as a conversion (the rest are plain events) */
    'conversions' => ['demo_booked', 'checkout_start', 'signup_paid', 'call_tap', 'text_tap', 'email_tap'],
    'events' => ['outbound', 'app_link_request'],
    /* a view of this page also records the event */
    'goal_paths' => ['/start/welcome/' => 'signup_paid'],
    /* never counted: the cloud machine and this server */
    'exclude_ips' => ['20.91.198.101', '35.208.70.82'],
    'keep_days' => 400, 'max_day' => 20000, 'per_visitor' => 150,
    'code_hash' => '<sha256 of "sv|" + the stats code>',
    'remotes' => [['id' => 'sixfold365', 'label' => 'Sixfold 365', 'host' => '365aeration.com', 'url' => 'https://365aeration.com/sv/c.php', 'key' => '<the 365 sum_key>']],
];
/* 365aeration.com: site sixfold365, label Sixfold 365, hosts 365aeration.com + aeration365.com (+ www), conversions quote_request,
   quote_accepted, agreement_signed, deposit_pay_tap, call_tap, text_tap, email_tap; goal_paths /q/ quote_viewed, /sign/ agreement_opened;
   'sum_key' => '<64 hex>' (the stats page's key); no code_hash, no remotes. */

<?php
/**
 * Template for sixfold-private/sms-config.php (each install's own private folder) — copy it, fill it in, never commit the copy.
 * In-app texting (api/sms.php). Twilio is the provider. Before real customers are texted, the company registers an
 * A2P 10DLC brand and campaign in Twilio (US carriers block unregistered business texting).
 *
 * Environment variables override this file: SIXFOLD_SMS_SID, SIXFOLD_SMS_TOKEN, SIXFOLD_SMS_FROM, SIXFOLD_SMS_SERVICE,
 * SIXFOLD_SMS_URL.
 *
 * The app shows texting only where company.json turns it on ("features": {"sms": true}) AND this file is filled in.
 */
return [
    'provider'              => 'twilio',
    // Twilio Console -> Account info.
    'account_sid'           => 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'auth_token'            => 'PASTE-THE-AUTH-TOKEN-HERE',
    // The number texts come from (+1 and ten digits), OR a Messaging Service (MG...), preferred once 10DLC is registered.
    'from'                  => '+1XXXXXXXXXX',
    'messaging_service_sid' => '',
    // The exact URL set in Twilio as the number's "A message comes in" webhook, e.g.
    // https://traverseplatforms.com/api/traverse-rounds.php?action=smsin  (replies are checked against it)
    'public_url'            => '',
    // Quiet hours, Colorado time: nothing is sent before quiet_start or from quiet_end on.
    'quiet_start'           => 8,
    'quiet_end'             => 21,
];

<?php
declare(strict_types=1);
/* The end-of-day email as an example to show (2026-10-30, Matthew: "an EXAMPLE PDF of what it looks like with made-up numbers for a sample
 * roofing company"). Every name and number below is MADE UP; the company is "Sample Roofing Co.", not a real business. The email is drawn by
 * the app's own code (traverse/app/api/eod-lib.php, eodRender), exactly as an install sends it, in the sample company's colour and logo.
 *   php traverse/business/eod-example.php > example.html      then: node traverse/business/eod-example-pdf.mjs (does both) */
require __DIR__ . '/../app/api/eod-lib.php';
$logo = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#ffffff"/><path d="M8 36 L32 14 L56 36" fill="none" stroke="#9c3d1e" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="M17 34 V50 H47 V34" fill="none" stroke="#9c3d1e" stroke-width="5" stroke-linejoin="round"/><rect x="28" y="38" width="8" height="12" fill="#9c3d1e"/></svg>');
$B = ['name' => 'Sample Roofing Co.', 'color' => '#9c3d1e', 'logo' => $logo, 'phone' => '(555) 010-2030', 'site' => 'sampleroofing.example'];
$R = ['date' => 'Fri 30 Oct', 'kpis' => [
        ['Money in today', '$18,450', '3 payments'],
        ['Jobs booked', '2', '$27,900'],
        ['Jobs done', '1', '$11,200'],
        ['Estimates sent', '6', 'worth $71,300']],
    'sections' => [
        ['title' => 'Money in', 'note' => 'Payments recorded in the app: cards, pay links, cash and checks.', 'rows' => [
            ['l' => 'This week', 'v' => '$41,650'],
            ['l' => 'This month', 'v' => '$163,200'],
            ['l' => 'Jobs done, not paid in full', 'v' => '$4,800', 's' => '1 job', 't' => 'warn']]],
        ['title' => 'Jobs done and booked', 'rows' => [
            ['l' => 'Booked: Dana K.', 'v' => '$15,400', 's' => 'sold by Marcus Reed · on Thu 5 Nov'],
            ['l' => 'Booked: Luis P.', 'v' => '$12,500', 's' => 'sold by Priya Shah · on Mon 9 Nov'],
            ['l' => 'Done: Greg H.', 'v' => '$11,200', 's' => 'Crew 1 (Tom Alvarez)'],
            ['l' => 'Today: Ann W.', 'v' => '$9,800', 's' => 'Crew 2 (Eli Brooks) · not marked done yet', 't' => 'warn']]],
        ['title' => 'Estimates', 'rows' => [
            ['l' => 'Estimates sent today', 'v' => '6', 's' => 'worth $71,300'],
            ['l' => 'Options picked', 'v' => '6', 's' => 'Better 3, Best 2, Good 1'],
            ['l' => 'Open estimates', 'v' => '$214,600', 's' => '17 estimates with no job yet'],
            ['l' => 'Close rate', 'v' => '38%', 's' => '11 of 29 quoted 1 to 8 weeks ago booked']]],
        ['title' => 'Leads by source', 'rows' => [
            ['l' => 'New today', 'v' => '9', 's' => 'At the door 4, Facebook ads 3, Website 1, Referrals 1'],
            ['l' => 'Last 7 days', 'v' => '47', 's' => 'At the door 21, Facebook ads 14, Website 7, Referrals 3, Phone calls 2'],
            ['l' => 'Waiting on a first call', 'v' => '3', 't' => 'warn']]],
        ['title' => 'Team today', 'rows' => [
            ['l' => '1. Marcus Reed', 'v' => '$15,400', 's' => '64 doors · 3 leads · 2 estimates · 1 job sold', 't' => 'good'],
            ['l' => '2. Priya Shah', 'v' => '$12,500', 's' => '52 doors · 2 leads · 2 estimates · 1 job sold', 't' => 'good'],
            ['l' => '3. Jordan Lee', 'v' => '81 doors', 's' => '81 doors · 4 leads · 1 estimate · 0 jobs sold'],
            ['l' => '4. Sam Ortiz', 'v' => '47 doors', 's' => '47 doors · 1 lead · 1 estimate · 0 jobs sold']]],
        ['title' => 'Tomorrow, Sat 31 Oct', 'rows' => [
            ['l' => 'Rachel M.', 'v' => '$13,900', 's' => '8:00 am · Crew 1 (Tom Alvarez)'],
            ['l' => 'Kevin B.', 'v' => '$8,600', 's' => '10:30 am · Crew 2 (Eli Brooks)'],
            ['l' => 'Maria G.', 'v' => 'held', 's' => 'not signed yet · Crew 1 (Tom Alvarez)', 't' => 'warn']]]],
    'foot' => 'From Sample Roofing Co.\'s app, for its admins and managers. Customer names are private: keep this inside Sample Roofing Co.'];
[$subject, , $html] = eodRender($R, $B, 'End of day, Fri 30 Oct: $18,450 in · 2 booked · 1 done · 6 estimates · 2 tomorrow');
/* for the PDF: a line above the email saying it is an example, and the colours kept when printing */
$cap = '<div style="max-width:600px;margin:14px auto 0;font:13px/1.4 -apple-system,Segoe UI,Arial,sans-serif;color:#566476;text-align:center">'
     . '<b style="color:#15202d">Example end-of-day email.</b> A sample roofing company with made-up names and numbers. Subject line: '
     . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . '</div>';
$html = str_replace('</head>', '<style>@page{margin:0}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}</style></head>', $html);
$html = preg_replace_callback('/<body([^>]*)>/', fn($m) => '<body' . $m[1] . '>' . $cap, $html, 1);   /* a callback: the caption's "$18,450" is not a back-reference */
echo $html;

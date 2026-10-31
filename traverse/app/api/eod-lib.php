<?php
declare(strict_types=1);
/* The end-of-day email for the editions and client installs (2026-10-30, Matthew: "END-OF-DAY REPORT, OPTIONAL"): the email itself, drawn
 * from the report as data. One shared file beside every install's API (like mail-oauth-lib.php): it holds no install's state and reads no
 * file, so the same drawing serves the app's Preview, "Send me a test", the hourly send (rounds.php action=eodcron, started by
 * sixfold-tools/edition-eod.php) and the example PDF (traverse/business/eod-example.php).
 *
 * The report, $R, is the same shape as Sixfold's own end-of-day report (tools/eod-report.php):
 *   date   'Fri 30 Oct'
 *   kpis   up to four [label, value, small line]
 *   sections [{title, note?, rows: [{l label, v value on the right, s small line under it, t tone good|bad|warn|''}], empty}]
 *   foot   the line at the bottom
 * $B, the company: name, color (#rrggbb, white text must read on it), logo (an absolute https address of a PNG or JPG, or ''), phone, site.
 * Nothing in it is Traverse's: the company's name, colour and logo only (Matthew: "zero Traverse branding in it"). Sixfold keeps its own
 * picture email (tools/eod-report.php, eod-image.php); nothing here touches it. */

/** the parts an admin can switch on or off, in the order the email shows them */
function eodSectionList(): array {
    return ['money' => ['Money in', 'Payments taken today, this week and this month.'],
            'jobs' => ['Jobs done and booked', 'What was finished today and what was sold today.'],
            'quotes' => ['Quotes sent', 'Quotes sent today, the options picked, open quotes and the close rate.'],
            'leads' => ['Leads by source', 'New leads today and in the last 7 days, by where they came from.'],
            'team' => ['Team leaderboard', 'Each person today: doors, leads, quotes and sales.'],
            'tomorrow' => ['Tomorrow\'s schedule', 'The jobs booked for tomorrow, with times and crews.']];
}

/** [subject, plain text, HTML] for one report */
function eodRender(array $R, array $B, string $subject): array {
    $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $col = preg_match('/^#[0-9a-f]{6}$/i', (string) ($B['color'] ?? '')) ? (string) $B['color'] : '#1f3a5f';
    $name = trim((string) ($B['name'] ?? '')) ?: 'Your company';
    $tone = ['good' => '#2e7d32', 'bad' => '#b3261e', 'warn' => '#9a5b00'];
    $font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif";

    /* the plain-text copy, for mail apps that show no HTML */
    $L = [$name . ', end of day, ' . $R['date'] . '.', ''];
    foreach ((array) $R['kpis'] as $k) $L[] = $k[0] . ': ' . $k[1] . ($k[2] !== '' ? ' (' . $k[2] . ')' : '');
    foreach ((array) $R['sections'] as $s) {
        $L[] = ''; $L[] = strtoupper((string) $s['title']);
        if (!empty($s['note'])) $L[] = (string) $s['note'];
        if (!$s['rows']) $L[] = '- ' . ($s['empty'] ?? 'Nothing.');
        foreach ($s['rows'] as $r) $L[] = '- ' . $r['l'] . ': ' . $r['v'] . (($r['s'] ?? '') !== '' ? ' (' . $r['s'] . ')' : '');
    }
    $L[] = ''; $L[] = '-- ' . $R['foot'];
    $text = implode("\n", $L);

    /* the HTML: tables and inline styles only, so Gmail, Outlook and phone mail apps all draw it the same; 600 px at most */
    $logo = (string) ($B['logo'] ?? '');
    $head = '<tr><td style="background:' . $col . ';padding:22px 24px;border-radius:14px 14px 0 0">'
          . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>'
          . ($logo !== '' ? '<td width="64" valign="middle" style="padding-right:14px"><div style="background:#ffffff;border-radius:12px;padding:6px;width:52px;height:52px;text-align:center"><img src="' . $e($logo) . '" alt="' . $e($name) . '" width="52" style="display:block;max-width:52px;max-height:52px;height:auto;border:0;margin:0 auto"></div></td>' : '')
          . '<td valign="middle" style="' . $font . ';color:#ffffff"><div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;opacity:.85">' . $e($name) . '</div>'
          . '<div style="font-size:26px;font-weight:800;line-height:1.2;margin-top:2px">End of day</div><div style="font-size:15px;opacity:.9;margin-top:2px">' . $e($R['date']) . '</div></td>'
          . '</tr></table></td></tr>';
    $tiles = '';
    $kp = array_values((array) $R['kpis']);
    for ($i = 0; $i < count($kp); $i += 2) {
        $tiles .= '<tr>';
        foreach ([0, 1] as $j) {
            $k = $kp[$i + $j] ?? null;
            $tiles .= '<td width="50%" valign="top" style="padding:6px">' . ($k ? '<div style="background:#f4f6f9;border-radius:12px;padding:14px 16px;' . $font . '">'
                    . '<div style="font-size:13px;color:#566476;font-weight:600">' . $e($k[0]) . '</div>'
                    . '<div style="font-size:28px;font-weight:800;color:' . $col . ';line-height:1.2;margin:4px 0 2px">' . $e($k[1]) . '</div>'
                    . '<div style="font-size:13px;color:#566476">' . $e($k[2]) . '</div></div>' : '') . '</td>';
        }
        $tiles .= '</tr>';
    }
    $secs = '';
    foreach ((array) $R['sections'] as $s) {
        $secs .= '<tr><td style="padding:18px 24px 4px;' . $font . '"><div style="font-size:17px;font-weight:800;color:' . $col . '">' . $e($s['title']) . '</div>'
               . '<div style="width:40px;height:3px;background:' . $col . ';margin-top:6px;border-radius:2px"></div>'
               . (!empty($s['note']) ? '<div style="font-size:13px;color:#566476;margin-top:8px">' . $e($s['note']) . '</div>' : '') . '</td></tr>';
        if (!$s['rows']) { $secs .= '<tr><td style="padding:6px 24px 8px;' . $font . ';font-size:15px;color:#566476">' . $e($s['empty'] ?? 'Nothing.') . '</td></tr>'; continue; }
        $rows = '';
        foreach ($s['rows'] as $r) {
            $t = (string) ($r['t'] ?? ''); $dot = isset($tone[$t]) && $t !== 'good' ? '<span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:' . $tone[$t] . ';margin-right:8px;vertical-align:middle"></span>' : '';
            $rows .= '<tr><td style="padding:10px 0;border-bottom:1px solid #e6e9ef;' . $font . '" valign="top">'
                   . '<div style="font-size:15px;font-weight:600;color:#15202d">' . $dot . $e($r['l']) . '</div>'
                   . (($r['s'] ?? '') !== '' ? '<div style="font-size:13px;color:#566476;margin-top:3px">' . $e($r['s']) . '</div>' : '') . '</td>'
                   . '<td style="padding:10px 0 10px 12px;border-bottom:1px solid #e6e9ef;' . $font . ';font-size:15px;font-weight:800;text-align:right;white-space:nowrap;color:' . ($tone[$t] ?? '#15202d') . '" valign="top">' . $e($r['v']) . '</td></tr>';
        }
        $secs .= '<tr><td style="padding:2px 24px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' . $rows . '</table></td></tr>';
    }
    $site = (string) ($B['site'] ?? ''); $foot = array_filter([$e($name), $e($B['phone'] ?? ''), $site !== '' ? $e(preg_replace('#^https?://#i', '', $site)) : '']);
    $html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $e($subject) . '</title></head>'
          . '<body style="margin:0;padding:0;background:#eef1f5"><div style="display:none;max-height:0;overflow:hidden">' . $e(implode(' · ', array_map(fn($k) => $k[0] . ' ' . $k[1], $kp))) . '</div>'
          . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef1f5"><tr><td align="center" style="padding:18px 10px">'
          . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:separate;width:100%;max-width:600px;background:#ffffff;border-radius:14px">'
          . $head
          . ($tiles !== '' ? '<tr><td style="padding:14px 18px 2px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' . $tiles . '</table></td></tr>' : '')
          . $secs
          . '<tr><td style="padding:18px 24px 22px;' . $font . ';font-size:12px;color:#7a8696;border-top:1px solid #e6e9ef">' . $e($R['foot']) . ($foot ? '<div style="margin-top:6px">' . implode(' &middot; ', $foot) . '</div>' : '') . '</td></tr>'
          . '</table></td></tr></table></body></html>';
    return [$subject, $text, $html];
}

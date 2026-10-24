<?php
declare(strict_types=1);
/* The end-of-day report as a picture (2026-10-23), drawn with GD so it needs nothing the server lacks. 1200 px wide and shown at
 * 600 in the email, so it is sharp on a phone; the text sizes are set for a phone, where the picture is about 375 px wide.
 * Sixfold 365 colours and fonts (Outfit, DM Sans: static cuts in eod-assets/, Open Font License) and the round badge. */
function eodImage(array $R, string $assets): string {
    $W = 1200; $P = 64; $IW = $W - 2 * $P;
    $F = ['h' => "$assets/Outfit-ExtraBold.ttf", 'h2' => "$assets/Outfit-SemiBold.ttf", 'r' => "$assets/DMSans-Regular.ttf", 'm' => "$assets/DMSans-SemiBold.ttf", 'b' => "$assets/DMSans-Bold.ttf"];
    $hex = fn(string $h) => [hexdec(substr($h, 1, 2)), hexdec(substr($h, 3, 2)), hexdec(substr($h, 5, 2))];
    $C = ['forest' => '#2F5D2C', 'forestd' => '#244a22', 'ink' => '#1D2A1C', 'soft' => '#5a6858', 'line' => '#E6DFD2', 'bone' => '#EDE7DC', 'cream' => '#FFF8EC', 'white' => '#FFFFFF', 'good' => '#3F7A34', 'bad' => '#B5481C', 'warn' => '#B5481C', 'tile' => '#F6F1E7', 'mint' => '#CFE3C4'];
    $width = function (string $t, string $f, float $s) { $b = imagettfbbox($s, 0, $f, $t); return $b[2] - $b[0]; };
    $wrap = function (string $t, string $f, float $s, int $max) use ($width): array {
        $out = []; $cur = '';
        foreach (preg_split('/\s+/', trim($t)) as $w) { $try = $cur === '' ? $w : "$cur $w"; if ($cur !== '' && $width($try, $f, $s) > $max) { $out[] = $cur; $cur = $w; } else $cur = $try; }
        if ($cur !== '') $out[] = $cur; return $out;
    };
    /* sizes (px at 1200 wide) */
    $S = ['kv' => 68, 'kl' => 27, 'ks' => 25, 'st' => 34, 'l' => 34, 'v' => 34, 's' => 27, 'note' => 25, 'foot' => 22];
    /* lay out first, to know the height: each op is drawn in the second pass */
    $ops = []; $y = 0;
    $head = 210; $y = $head + 44;
    /* KPI tiles, two by two */
    $tw = ($IW - 28) / 2; $th = 222;
    foreach ($R['kpis'] as $i => $k) { $x = $P + ($i % 2) * ($tw + 28); $ty = $y + intdiv($i, 2) * ($th + 28); $ops[] = ['tile', $x, $ty, $tw, $th, $k]; }
    $y += 2 * $th + 28 + 16;
    foreach ($R['sections'] as $sec) {
        $y += 52; $ops[] = ['title', $P, $y, $sec['title']]; $y += 22;
        if (!empty($sec['note'])) { foreach ($wrap($sec['note'], $F['r'], $S['note'], $IW) as $ln) { $y += 36; $ops[] = ['text', $P, $y, $ln, $F['r'], $S['note'], 'soft']; } $y += 6; }
        if (!$sec['rows']) { $y += 58; $ops[] = ['text', $P, $y, $sec['empty'] ?? 'Nothing.', $F['r'], $S['l'], 'soft']; $y += 26; }
        foreach ($sec['rows'] as $r) {
            $vw = $width($r['v'], $F['b'], $S['v']); $lmax = $IW - $vw - 36 - (!empty($r['t']) && $r['t'] !== 'good' ? 30 : 0);
            $ls = $wrap($r['l'], $F['m'], $S['l'], $lmax); $ss = ($r['s'] ?? '') !== '' ? $wrap($r['s'], $F['r'], $S['s'], $IW - 30) : [];
            $y += 24; $top = $y;
            foreach ($ls as $i => $ln) { $y += $i ? 44 : 40; $ops[] = ['label', $P, $y, $ln, $r['t'] ?? '', $i === 0]; }
            $ops[] = ['value', $W - $P, $top + 40, $r['v'], $r['t'] ?? ''];
            foreach ($ss as $i => $ln) { $y += $i ? 40 : 46; $ops[] = ['text', $P + (!empty($r['t']) && $r['t'] !== 'good' ? 30 : 0), $y, $ln, $F['r'], $S['s'], 'soft']; }
            $y += 24; $ops[] = ['rule', $P, $y, $W - $P];
        }
        $y += 12;
    }
    $y += 40; foreach ($wrap($R['foot'], $F['r'], $S['foot'], $IW) as $ln) { $ops[] = ['text', $P, $y, $ln, $F['r'], $S['foot'], 'soft']; $y += 32; }
    $H = (int) $y + 36;

    $im = imagecreatetruecolor($W, $H); imagesavealpha($im, false); imageantialias($im, true);
    $col = []; foreach ($C as $k => $h) { [$r, $g, $b] = $hex($h); $col[$k] = imagecolorallocate($im, $r, $g, $b); }
    imagefilledrectangle($im, 0, 0, $W, $H, $col['white']);
    /* header band: badge, title, date */
    imagefilledrectangle($im, 0, 0, $W, $head, $col['forest']);
    $bp = @imagecreatefrompng("$assets/badge.png");
    if ($bp) { $bs = 150; $disk = 162; imagefilledellipse($im, $P + intdiv($disk, 2), intdiv($head, 2), $disk, $disk, $col['cream']); imagecopyresampled($im, $bp, $P + intdiv($disk - $bs, 2), intdiv($head - $bs, 2), 0, 0, $bs, $bs, imagesx($bp), imagesy($bp)); }
    $tx = $P + 162 + 36;
    imagettftext($im, 60, 0, $tx, 108, $col['white'], $F['h'], 'End of day');
    imagettftext($im, 32, 0, $tx, 160, $col['mint'], $F['m'], $R['date']);
    $rnd = function ($x1, $y1, $x2, $y2, $r, $c) use ($im) {
        imagefilledrectangle($im, (int) ($x1 + $r), (int) $y1, (int) ($x2 - $r), (int) $y2, $c); imagefilledrectangle($im, (int) $x1, (int) ($y1 + $r), (int) $x2, (int) ($y2 - $r), $c);
        foreach ([[$x1 + $r, $y1 + $r], [$x2 - $r, $y1 + $r], [$x1 + $r, $y2 - $r], [$x2 - $r, $y2 - $r]] as [$cx, $cy]) imagefilledellipse($im, (int) $cx, (int) $cy, 2 * $r, 2 * $r, $c);
    };
    foreach ($ops as $o) {
        switch ($o[0]) {
            case 'tile': [, $x, $ty, $tw0, $th0, $k] = $o; $rnd($x, $ty, $x + $tw0, $ty + $th0, 22, $col['tile']);
                imagettftext($im, $S['kl'], 0, (int) $x + 30, (int) $ty + 52, $col['soft'], $F['m'], $k[0]);
                imagettftext($im, $S['kv'], 0, (int) $x + 28, (int) $ty + 152, $col['forestd'], $F['h'], $k[1]);
                imagettftext($im, $S['ks'], 0, (int) $x + 30, (int) $ty + 196, $col['soft'], $F['r'], $k[2]); break;
            case 'title': imagettftext($im, $S['st'], 0, $o[1], (int) $o[2] + 10, $col['forest'], $F['h2'], $o[3]); imagefilledrectangle($im, $o[1], (int) $o[2] + 24, $o[1] + 72, (int) $o[2] + 28, $col['forest']); break;
            case 'label': $dx = 0; if ($o[4] !== '' && $o[4] !== 'good') { $dx = 30; if ($o[5]) imagefilledellipse($im, $o[1] + 8, (int) $o[2] - 12, 16, 16, $col[$o[4]]); }
                imagettftext($im, $S['l'], 0, $o[1] + $dx, (int) $o[2], $col['ink'], $F['m'], $o[3]); break;
            case 'value': $vw = imagettfbbox($S['v'], 0, $F['b'], $o[3]); imagettftext($im, $S['v'], 0, (int) ($o[1] - ($vw[2] - $vw[0])), (int) $o[2], $o[4] === 'good' ? $col['good'] : ($o[4] === 'bad' ? $col['bad'] : $col['ink']), $F['b'], $o[3]); break;
            case 'text': imagettftext($im, $o[5], 0, (int) $o[1], (int) $o[2], $col[$o[6]], $o[4], $o[3]); break;
            case 'rule': imagefilledrectangle($im, $o[1], (int) $o[2], $o[3], (int) $o[2] + 1, $col['line']); break;
        }
    }
    imagetruecolortopalette($im, false, 255); ob_start(); imagepng($im, null, 9); $png = (string) ob_get_clean(); imagedestroy($im);
    return $png;
}

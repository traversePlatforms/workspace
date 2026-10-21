    out((function () {   /* the Wi-Fi queue's "houses we are visiting" list (2026-10-20, Matthew: "prioritize properies that we are visiting"). READ-ONLY.
                            Door ids and neighbourhood names only: houses tied to a lead (jobs and customers come from leads) or a desk walk,
                            doors handed to one person, neighbourhoods assigned to someone, and doors knocked in the last 30 days. */
        $idx = json_decode((string) file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
        $first = []; $areas = []; $knocked = []; $cut = time() - 30 * 86400;
        foreach (leadsAll() as $l) { $h = $l['house'] ?? null; if (is_array($h) && !empty($h['region']) && !empty($h['door'])) $first[(string) $h['region']][(string) $h['door']] = 1; }
        foreach (deskWalks() as $w) if (($w['kind'] ?? '') === 'door' && !empty($w['region']) && !empty($w['door'])) $first[(string) $w['region']][(string) $w['door']] = 1;
        foreach ($idx['regions'] as $r) {
            $k = (string) $r['key'];
            foreach (loadAssign($k) as $area => $who) if ($who !== '' && $who !== null) $areas[$k][(string) $area] = 1;
            foreach (loadDoorAssign($k) as $door => $who) if ($who !== '' && $who !== null) $first[$k][(string) $door] = 1;
            foreach (loadMarks($k) as $door => $m) if ((int) ($m['at'] ?? 0) >= $cut) $knocked[$k][(string) $door] = 1;
        }
        $keys = fn($m) => array_map(fn($x) => array_keys($x), $m);
        return ['ok' => true, 'at' => date('c'), 'first' => $keys($first), 'areas' => $keys($areas), 'knocked' => $keys($knocked)];
    })());

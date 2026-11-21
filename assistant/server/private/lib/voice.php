<?php
/* Talk to J.A.R.V.I.S. without Siri (2026-11-19, Matthew: "build out all the voice actions we can use to allow me to talk to jarvis easily.
   id rather not use siri to contact jarvis"). One door for spoken words from outside the page: the iPhone Shortcut "Jarvis" (Dictate Text,
   then a POST here with that phone's voice key in an X-Voice-Key header, then Speak Text of the answer). Vocal Shortcuts ("Hey Jarvis") and
   Back Tap run that Shortcut. The answer is short plain text, made to be heard (?format=json gives {ok, intent, say}; 20 Nov, P-11: &audio=1 adds audio, a link to the answer in the ElevenLabs voice, lib/tts.php).
   How a sentence is answered:
     quick ones, here and at once, with no model call: remind me…, add … to my calendar…, add … to groceries, brief me, what's on today,
       what's new / what's waiting, what's building, remember / note … (that one goes to the desk, which keeps his memory);
     anything that would send, post or message someone: ONLY ever a draft (a desk thread marked DRAFT ONLY; nothing here can send);
     laptop work (build…, look into…, draft…, fix…, anything long): a new desk thread, "Sent to the desk; I'll alert you when it's done.";
     everything else, a question: the instant Assistant (lib/chat.php, the same conversation as Ask), told to answer in under 60 words.
   Voice keys: made on J.A.R.V.I.S.'s "Talk without Siri" page while signed in, one per device, shown once; only their SHA-256 is kept
   (data/jarvis/voice-keys.json). A wrong key counts as a wrong sign-in try. Each key: 30 requests in 10 minutes, 300 a day.
   The log line names the key and the kind of request, never the words or the key. */
declare(strict_types=1);

const VO_MAX = 2000;
function voKeysFile(): string { @mkdir(aDataDir() . '/jarvis', 0700, true); return 'jarvis/voice-keys.json'; }
function voKeys(): array { return array_filter(jget(voKeysFile()), 'is_array'); }
function voName(string $n): string { return mb_substr(trim((string) preg_replace('/[^\p{L}\p{N} .\'-]/u', '', $n)), 0, 30); }
/** the page's list: names and use, never a key or its hash */
function voKeyList(): array {
    $o = [];
    foreach (voKeys() as $id => $k) $o[] = ['id' => (string) $id, 'name' => (string) ($k['name'] ?? ''), 'made' => (int) ($k['made'] ?? 0), 'last' => (int) ($k['last'] ?? 0), 'uses' => (int) ($k['uses'] ?? 0)];
    usort($o, fn($a, $b) => $b['made'] <=> $a['made']);
    return $o;
}
/** a new key for one device: returned once, here, and never again */
function voKeyNew(string $name): array {
    $name = voName($name);
    if (mb_strlen($name) < 2) return ['ok' => false, 'error' => 'Name the device first, like iPhone.'];
    if (count(voKeys()) >= 8) return ['ok' => false, 'error' => 'There are 8 voice keys already. Revoke one first.'];
    $key = 'jvk_' . rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    $id = 'v' . bin2hex(random_bytes(4));
    jedit(voKeysFile(), function ($a) use ($id, $name, $key) { $a[$id] = ['name' => $name, 'sha256' => hash('sha256', $key), 'made' => time(), 'last' => 0, 'uses' => 0]; return $a; });
    alog('voice key made', ['name' => $name]);
    return ['ok' => true, 'id' => $id, 'name' => $name, 'key' => $key];
}
function voKeyDrop(string $id): array {
    $had = null;
    jedit(voKeysFile(), function ($a) use ($id, &$had) { if (isset($a[$id])) { $had = (string) ($a[$id]['name'] ?? ''); unset($a[$id]); } return $a; });
    if ($had === null) return ['ok' => false, 'error' => 'That key is not there any more.'];
    alog('voice key revoked', ['name' => $had]);
    return ['ok' => true];
}
function voKeyCheck(string $key): ?array {
    $key = trim($key); if (strlen($key) < 20 || strlen($key) > 200) return null;
    $h = hash('sha256', $key);
    foreach (voKeys() as $id => $k) if (hash_equals((string) ($k['sha256'] ?? ''), $h)) return ['id' => (string) $id, 'name' => (string) ($k['name'] ?? '')];
    return null;
}
function voTouch(string $id): void {
    jedit(voKeysFile(), function ($a) use ($id) { if (isset($a[$id])) { $a[$id]['last'] = time(); $a[$id]['uses'] = (int) ($a[$id]['uses'] ?? 0) + 1; } return $a; });
}
/** 30 in 10 minutes and 300 a day, per key (the page's own "Try it" counts as one key) */
function voRateOk(string $id): bool {
    $ok = true;
    jedit('jarvis/voice-rate.json', function ($r) use ($id, &$ok) {
        $now = time(); $l = array_values(array_filter((array) ($r[$id] ?? []), fn($t) => is_int($t) && $t > $now - 86400));
        $recent = count(array_filter($l, fn($t) => $t > $now - 600));
        if ($recent >= 30 || count($l) >= 300) { $ok = false; return $r; }
        $l[] = $now; $r[$id] = $l; return $r;
    });
    return $ok;
}
function voUrl(): string {
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'traverseplatforms.com') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/a-e018bb82/api.php'), '/') . '/api.php?action=voice';
}

/** the Shortcut's door: action=voice. Plain text back (what Speak Text reads), or JSON with ?format=json. Never returns a key. */
function voiceHttp(array $body, bool $isPost): never {
    $json = (string) ($_GET['format'] ?? ($body['format'] ?? '')) === 'json';
    $reply = function (int $code, string $say, array $extra = []) use ($json): never {
        http_response_code($code);
        if ($json) { header('Content-Type: application/json; charset=utf-8'); echo json_encode(['ok' => $code === 200, 'say' => $say] + $extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }
        else { header('Content-Type: text/plain; charset=utf-8'); echo $say; }
        exit;
    };
    if (!$isPost) $reply(405, 'Send the words with POST, as text.');
    if (tooManyTries()) $reply(429, 'Too many wrong voice keys from here. Wait 15 minutes.');
    $k = voKeyCheck((string) ($_SERVER['HTTP_X_VOICE_KEY'] ?? ''));
    if (!$k) { noteTry(); alog('voice key refused', ['ip' => ip()]); $reply(401, 'That voice key is not right. Make a new one in J.A.R.V.I.S., under Talk without Siri, and paste it into the Shortcut.'); }
    if (!voRateOk($k['id'])) { alog('voice rate limit', ['key' => $k['name']]); $reply(429, 'That is a lot of voice requests. Give it a few minutes.'); }
    $text = $body['text'] ?? ($_POST['text'] ?? '');
    if (is_array($text)) $text = implode(' ', array_filter($text, 'is_string'));
    $r = voRoute((string) $text, $k);
    voTouch($k['id']);
    alog('voice', ['key' => $k['name'], 'intent' => $r['intent'], 'chars' => mb_strlen((string) $text)]);
    /* 20 Nov (P-11): &audio=1 with format=json: the answer in the natural voice too, as a 15-minute link (only when it could be made;
       otherwise no audio field, and the Shortcut speaks the words with Speak Text as before) */
    $extra = ['intent' => $r['intent']] + (isset($r['thread']) ? ['thread' => $r['thread']] : []);
    if ($json && (string) ($_GET['audio'] ?? ($body['audio'] ?? '')) === '1' && function_exists('ttsForVoice')) {
        $link = ttsForVoice((string) $r['say'], (string) preg_replace('/\?.*$/', '', voUrl()));
        if ($link !== null) $extra['audio'] = $link;
    }
    $reply(200, $r['say'], $extra);
}
/** the setup page's "Try it here", signed in: the same routing, as JSON */
function voiceTry(string $text): array {
    if (!voRateOk('page')) return ['ok' => false, 'error' => 'That is a lot of tries. Give it a few minutes.'];
    $r = voRoute($text, ['id' => 'page', 'name' => 'J.A.R.V.I.S. page']);
    alog('voice', ['key' => 'page', 'intent' => $r['intent'], 'chars' => mb_strlen($text)]);
    return ['ok' => true, 'intent' => $r['intent'], 'say' => $r['say']] + (isset($r['thread']) ? ['thread' => $r['thread']] : []);
}

/* ---------------------------------------------------------------- what he said, and where it goes */
function voNorm(string $t): string {
    $t = trim((string) preg_replace('/\s+/u', ' ', jdClean($t, VO_MAX)));
    $t = (string) preg_replace('/^(?:(?:hey|hi|okay|ok|yo)[\s,]+)?(?:jarvis|j\.a\.r\.v\.i\.s\.?)\b[\s,.:;!?-]*/iu', '', $t);
    return trim($t);
}
function voRoute(string $raw, array $k): array {
    $t = voNorm($raw); $low = mb_strtolower($t); $bare = trim((string) preg_replace('/[.!?,]+$/u', '', $low));
    $words = $bare === '' ? 0 : count(preg_split('/\s+/u', $bare));
    if (mb_strlen($bare) < 2) return ['intent' => 'empty', 'say' => 'I did not catch that. Try again.'];
    if (preg_match('/^(?:never ?mind|cancel|stop|nothing|no thanks?|that\'?s all|that is all|thanks?|thank you)(?: jarvis)?$/u', $bare)) return ['intent' => 'bye', 'say' => 'Okay.'];
    $q = '(?:please\s+)?(?:can you\s+|could you\s+|would you\s+|i need you to\s+|go ahead and\s+)?';
    /* reminders (first: "remind me to send the invoice" is a reminder, not a send) */
    if (preg_match('/^' . $q . '(?:set (?:a |me a )?reminder(?: for me)?(?: to| for| about)?|remind me)\b\s*(.*)$/u', $bare)) {
        $rest = (string) preg_replace('/^' . $q . '(?:set (?:a |me a )?reminder(?: for me)?(?: to| for| about)?|remind me)\b\s*/iu', '', $t);
        $w = voWhen($rest);
        if ($w) return voRemind($w['text'], $w['date'], $w['time']);
        if (claude()) return voAsk($t, $k);   /* the Assistant has add_reminder for the dates this cannot read */
        return ['intent' => 'remind-what', 'say' => 'Say the day too, like: remind me Friday at 9 to call Tyler.'];
    }
    /* remember / note: the desk keeps his memory */
    if (preg_match('/^' . $q . '(?:remember|note|make a note|take a note|note to self|save a note|jot down)(?:\s+(?:this|that|of this|to self))?[\s:,-]*(.*)$/iu', $t, $m)) {
        $what = trim($m[1]);
        if (mb_strlen($what) < 3) return ['intent' => 'remember-what', 'say' => 'What should I remember? Say remember that, then the thing.'];
        $d = voDeskSend('[REMEMBER THIS]' . "\n" . $what . "\n\n(Said by voice through the Jarvis Shortcut (" . $k['name'] . "), speech to text, so a word may be misheard. Save this into the Claude Code memory under the \"Remember this\" rules in your prompt, then confirm back what was saved and in which file.)", $k);
        if (!$d['ok']) return ['intent' => 'remember', 'say' => 'The desk did not take it: ' . $d['error']];
        return ['intent' => 'remember', 'say' => 'Got it. The desk will save that to your memory.', 'thread' => $d['id']];
    }
    /* 20 Nov (P-12): recording a meeting needs the J.A.R.V.I.S. screen (the company, the consent tap, the screen kept on) */
    if ($words <= 8 && preg_match('/^' . $q . '(?:start\s+)?(?:record(?:ing)?|tape)\s+(?:this|the|a|my|our)\s+meeting\b|^' . $q . 'start (?:a |the )?(?:meeting )?recording\b/u', $bare))
        return ['intent' => 'meeting-record', 'say' => 'The Shortcut cannot record. Open J.A.R.V.I.S., tap Meeting notes, pick the company and tap Record. On the laptop, say Hey Jarvis, record this meeting.'];
    if ($words <= 6 && preg_match('/^(?:stop|end|pause) (?:the )?(?:meeting )?recording\b/u', $bare))
        return ['intent' => 'meeting-stop', 'say' => 'A recording stops from the J.A.R.V.I.S. screen: tap Stop there.'];
    /* anything that would send, post or message someone: a draft, only ever */
    if (voIsSend($bare)) return voDesk($t, $k, 'draft');
    /* the calendar */
    if (preg_match('/^' . $q . '(?:add|put)\s+(.+?)\s+(?:on|to|in|into)\s+(?:my|the)\s+(?:traverse\s+)?calendar\b[\s,:-]*(.*)$/iu', $t, $m)
        || preg_match('/^' . $q . '(?:add|put)\s+(?:to|on|in)\s+(?:my|the)\s+calendar\b[\s,:-]*()(.+)$/iu', $t, $m)
        || preg_match('/^' . $q . '(?:schedule|book)\s+((?:a|an)\s+(?:meeting|call|appointment|lunch|dinner|coffee)\b.*)()$/iu', $t, $m)) return voCalendar(trim($m[1] . ' ' . $m[2]));
    /* groceries */
    if (preg_match('/^' . $q . 'add\s+(.+?)\s+to\s+(?:my\s+|the\s+)?(?:grocer(?:y|ies)(?:\s+list)?|shopping(?:\s+list)?)[.!]?$/iu', $t, $m)) return voGroceries($m[1]);
    /* the quick reads */
    if (preg_match('/^(?:brief me|morning brief(?:ing)?|(?:give|read) me (?:the|my|a) (?:morning )?brief(?:ing)?|(?:what\'?s|what is) (?:the|my) (?:morning )?brief(?:ing)?|briefing|catch me up|(?:what\'?s|what is|how\'?s|how is) my day(?: look(?:ing)?(?: like)?)?)$/u', $bare)) return ['intent' => 'brief', 'say' => voBrief()];
    if ($words <= 9 && preg_match('/^(?:what\'?s|what is|what do i have|what have i got|anything|do i have anything|is there anything)\b/u', $bare) && preg_match('/\b(?:calendar|schedule|today|tonight|tomorrow)\b/u', $bare) && !preg_match('/\b(?:email|emails|mail|waiting|new)\b/u', $bare))
        return ['intent' => 'today', 'say' => voDay(preg_match('/\btomorrow\b/u', $bare) ? 1 : 0)];
    if ($words <= 9 && preg_match('/^(?:what\'?s|what is|anything|is there anything|any)\s+(?:new|waiting|urgent)\b|^what needs me\b|^what(?:\'s| is| do i)? (?:need|needs) (?:me|my attention|doing)\b|^(?:any|check) (?:new )?(?:messages|emails|mail)\b|^what\'?s up\b/u', $bare))
        return ['intent' => 'new', 'say' => voNew($k['id'])];
    if ($words <= 8 && preg_match('/^(?:what\'?s|what is) building\b|^(?:any|how are the|how\'?s the|how is the) builds?\b|^build status\b/u', $bare)) return ['intent' => 'builds', 'say' => voBuilds()];
    /* the desk, by name, or work for the laptop */
    if (preg_match('/^(?:ask|tell|send (?:this |it )?to|for|give (?:this|it) to) the desk\b[\s:,-]*(.*)$/iu', $t, $m) || preg_match('/^desk[\s:,-]+(.+)$/iu', $t, $m))
        return mb_strlen(trim($m[1])) < 3 ? ['intent' => 'desk-what', 'say' => 'What should the desk do?'] : voDesk(trim($m[1]), $k, 'desk');
    if (mb_strlen($t) > 280 || preg_match('/^' . $q . '(?:build|look into|look at|draft|research|investigate|fix|make|create|write|update|deploy|set up|setup|check on|find out|figure out|work on|design|change|move|rename|review|audit|plan|prepare|put together|start|finish|run|test|upload|add a|add an|go through|clean up|sort out)\b/u', $bare))
        return voDesk($t, $k, 'desk');
    return voAsk($t, $k);
}
/** would this send, post, publish or message someone? (then it is only ever a draft) */
function voIsSend(string $s): bool {
    $q = '(?:please\s+)?(?:can you\s+|could you\s+|would you\s+|go ahead and\s+)?';
    if (preg_match('/^' . $q . '(?:send|email|e-mail|text|message|reply|respond|post|publish|tweet|dm|share|forward|announce)\b/u', $s)) return true;
    if (preg_match('/^' . $q . '(?:tell|let)\s+(?!me\b|the desk\b)[\p{L}\']+\s+(?:know\s+)?(?:that|about|i\b|we\b|it\b|he\b|she\b|they\b)/u', $s)) return true;
    if (!preg_match('/^(?:what|when|did|has|have|is|was|who|how|why|where|which|do|does|any|are|were|can i|should)\b/u', $s)
        && preg_match('/\b(?:send|post|publish|schedule|queue|tweet)\b.{0,40}\b(?:email|emails|text|texts|message|messages|post|posts|caption|newsletter|tweet|reel|story|stories|invoice|reply)\b/u', $s)) return true;
    return false;
}
function voLaptopAwake(): bool {
    $f = aDataDir() . '/jarvis/status.json'; $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    $bf = aDataDir() . '/jarvis/beat.txt'; $beat = max(is_array($j) ? (int) ($j['pushedAt'] ?? 0) : 0, is_file($bf) ? (int) trim((string) file_get_contents($bf)) : 0);
    return time() - $beat < 12 * 60;
}
function voDeskSend(string $text, array $k): array {
    $r = jdSend(['text' => $text, 'ctx' => ['screen' => 'voice', 'name' => mb_substr('Voice: ' . $k['name'], 0, 80)]]);
    return $r['ok'] ? ['ok' => true, 'id' => (string) $r['thread']['id']] : ['ok' => false, 'error' => (string) ($r['error'] ?? 'try again')];
}
/** a new desk thread; $kind draft: something that would send or post, which the desk only ever drafts */
function voDesk(string $t, array $k, string $kind): array {
    $note = $kind === 'draft'
        ? "(Said by voice through the Jarvis Shortcut (" . $k['name'] . "), speech to text, so a word may be misheard. He asked for something that would send, post or message someone: DRAFT ONLY. Write it as a draft (a draft file, or a Gmail draft through the Assistant) and never send, post, schedule or queue it. Reply with a short summary he can hear and where the draft is.)"
        : "(Said by voice through the Jarvis Shortcut (" . $k['name'] . "), speech to text, so a word may be misheard. Reply with a short summary he can hear. Nothing is sent, posted or scheduled from a voice request: anything like that is a draft only.)";
    $d = voDeskSend('[VOICE' . ($kind === 'draft' ? ' · DRAFT ONLY' : '') . '] ' . $t . "\n\n" . $note, $k);
    if (!$d['ok']) return ['intent' => $kind, 'say' => 'The desk did not take it: ' . $d['error']];
    $awake = voLaptopAwake();
    $say = $kind === 'draft'
        ? 'I’ve asked the desk for a draft. Nothing gets sent; you review it first. I’ll alert you when it’s ready.'
        : 'Sent to the desk; I’ll alert you when it’s done.';
    if (!$awake) $say .= ' Your laptop is asleep, so it starts when the laptop wakes.';
    return ['intent' => $kind, 'say' => $say, 'thread' => $d['id']];
}
/** a question: the instant Assistant, the same conversation as Ask, told it is being heard. If it cannot answer, the desk gets it. */
function voAsk(string $t, array $k): array {
    $r = function_exists('chatTurn') ? chatTurn($t, ['voice' => true, 'k' => $k]) : ['ok' => false];
    if (empty($r['ok'])) {
        $d = voDesk($t, $k, 'desk');
        if (isset($d['thread'])) $d['say'] = 'The Assistant couldn’t answer just now, so I sent it to the desk. I’ll alert you when it’s done.';
        $d['intent'] = 'ask-desk'; return $d;
    }
    /* 21 Nov (P-13): the Assistant decided it is laptop work and handed it to the desk itself (send_to_desk) */
    foreach ((array) ($r['actions'] ?? []) as $a) if (($a['type'] ?? '') === 'desk') {
        return ['intent' => 'desk', 'say' => 'Sent to the desk; I’ll alert you when it’s done.' . (voLaptopAwake() ? '' : ' Your laptop is asleep, so it starts when the laptop wakes.'), 'thread' => (string) $a['id']];
    }
    $say = voSpeakable((string) $r['reply']);
    foreach ((array) ($r['actions'] ?? []) as $a) if (($a['type'] ?? '') === 'review') { $say .= ' The reply is saved as a Gmail draft. Nothing was sent.'; break; }
    return ['intent' => 'ask', 'say' => $say];
}
/** plain spoken sentences: no markdown, no links, at most about 90 words */
function voSpeakable(string $s): string {
    $s = (string) preg_replace('/https?:\/\/\S+/u', 'the link', $s);
    $s = (string) preg_replace('/[*_`#>]+/u', '', $s);
    $s = (string) preg_replace('/\s*\n+\s*(?:[-•]|\d+[.)])\s*/u', '. ', $s);
    $s = trim((string) preg_replace('/\s+/u', ' ', $s));
    $s = (string) preg_replace('/\.\s*\./u', '.', $s);
    $w = preg_split('/\s+/u', $s);
    if (count($w) > 90) {
        $cut = implode(' ', array_slice($w, 0, 90)); $p = max(mb_strrpos($cut, '. ') ?: 0, mb_strrpos($cut, '? ') ?: 0);
        $s = ($p > 80 ? mb_substr($cut, 0, $p + 1) : $cut . '…') . ' The rest is in J.A.R.V.I.S.';
    }
    return $s !== '' ? $s : 'I did not get an answer back. Try again.';
}

/* ---------------------------------------------------------------- dates, as said */
/** "Friday at 9", "4 Jan", "tomorrow at 3pm", "in 20 minutes": ['text' => what is left, 'date' => Y-m-d, 'time' => H:i or ''] or null */
function voWhen(string $t, ?DateTime $now = null): ?array {
    $tz = jvTz(); $now = $now ? (clone $now)->setTimezone($tz) : new DateTime('now', $tz);
    $s = ' ' . trim((string) preg_replace('/[.!?]+$/u', '', trim($t))) . ' '; $date = null; $time = '';
    $today = (clone $now)->setTime(0, 0);
    $MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    $MRE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    $mk = function (int $y, int $mo, int $d) use ($tz): ?DateTime { return checkdate($mo + 1, $d, $y) ? new DateTime(sprintf('%04d-%02d-%02d', $y, $mo + 1, $d), $tz) : null; };
    $cut = function (array $m) use (&$s) { $s = substr_replace($s, ' ', (int) $m[0][1], strlen((string) $m[0][0])); };
    $num = fn($x) => ['a' => 1, 'an' => 1, 'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'ten' => 10, 'fifteen' => 15, 'twenty' => 20, 'thirty' => 30, 'forty five' => 45][strtolower($x)] ?? (int) $x;
    if (preg_match('/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?' . $MRE . '(?:,?\s+(\d{4}))?(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $mo = array_search(strtolower(substr($m[2][0], 0, 3)), $MON, true); $y = !empty($m[3][0]) ? (int) $m[3][0] : (int) $now->format('Y');
        $date = $mk($y, (int) $mo, (int) $m[1][0]); if ($date && empty($m[3][0]) && $date < $today) $date = $mk($y + 1, (int) $mo, (int) $m[1][0]); $cut($m);
    } elseif (preg_match('/\s(?:on\s+)?' . $MRE . '\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $mo = array_search(strtolower(substr($m[1][0], 0, 3)), $MON, true); $y = !empty($m[3][0]) ? (int) $m[3][0] : (int) $now->format('Y');
        $date = $mk($y, (int) $mo, (int) $m[2][0]); if ($date && empty($m[3][0]) && $date < $today) $date = $mk($y + 1, (int) $mo, (int) $m[2][0]); $cut($m);
    } elseif (preg_match('/\s(today|tonight|tomorrow)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $date = clone $today; if (strtolower($m[1][0]) === 'tomorrow') $date->modify('+1 day'); if (strtolower($m[1][0]) === 'tonight' && !preg_match('/\sat\s/iu', $s)) $time = '19:00'; $cut($m);
    } elseif (preg_match('/\s(?:on\s+)?(?:this\s+|next\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $want = array_search(strtolower($m[1][0]), ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], true);
        $add = ((int) $want - (int) $today->format('w') + 7) % 7 ?: 7; $date = (clone $today)->modify('+' . $add . ' days'); $cut($m);   /* "Friday" and "next Friday" both mean the coming one */
    } elseif (preg_match('/\sin\s+(\d{1,3}|a|an|one|two|three)\s+(days?|weeks?)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $n = $num($m[1][0]); $date = (clone $today)->modify('+' . ($n * (stripos($m[2][0], 'week') === 0 ? 7 : 1)) . ' days'); $cut($m);
    } elseif (preg_match('/\sin\s+(\d{1,3}|a|an|one|two|three|four|five|ten|fifteen|twenty|thirty|forty five|half an?)\s+(minutes?|mins?|hours?)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $mins = stripos($m[1][0], 'half') === 0 ? 30 : $num($m[1][0]) * (stripos($m[2][0], 'h') === 0 ? 60 : 1);
        if ($mins > 0 && $mins <= 24 * 60) { $at = (clone $now)->modify('+' . $mins . ' minutes'); $date = (clone $at)->setTime(0, 0); $time = $at->format('H:i'); }
        $cut($m);
    }
    if (preg_match('/\s(?:at\s+)?(\d{1,2})(?::(\d\d))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $h = (int) $m[1][0] % 12 + (stripos($m[3][0], 'p') === 0 ? 12 : 0); $mi = (int) ($m[2][0] ?? 0);
        if ($h < 24 && $mi < 60 && (int) $m[1][0] <= 12) $time = sprintf('%02d:%02d', $h, $mi); $cut($m);
    } elseif (preg_match('/\sat\s+(\d{1,2}):(\d\d)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        if ((int) $m[1][0] < 24 && (int) $m[2][0] < 60) $time = sprintf('%02d:%02d', (int) $m[1][0], (int) $m[2][0]); $cut($m);
    } elseif (preg_match('/\sat\s+(noon|midday|midnight)(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $time = strtolower($m[1][0]) === 'midnight' ? '00:00' : '12:00'; $cut($m);
    } elseif (preg_match('/\sat\s+(\d{1,2})(?:\s+o\'?clock)?(?=\s)/iu', $s, $m, PREG_OFFSET_CAPTURE)) {
        $h = (int) $m[1][0]; if ($h >= 1 && $h <= 12) { $time = sprintf('%02d:00', $h <= 6 || $h === 12 ? ($h === 12 ? 12 : $h + 12) : $h); $cut($m); }   /* "at 9" is morning, "at 3" afternoon */
    }
    if (!$date && $time !== '') { $date = clone $today; if ((new DateTime($today->format('Y-m-d') . ' ' . $time, $tz)) < $now) $date->modify('+1 day'); }   /* "at 3pm": today, or tomorrow once it has gone */
    $text = trim((string) preg_replace('/\s+/u', ' ', $s));
    $text = trim((string) preg_replace('/\s+(?:on|at|by|for)$/iu', '', (string) preg_replace('/^(?:to|about|that|of|on|at|for)\s+/iu', '', $text)));
    if (!$date || mb_strlen($text) < 2) return null;
    if (preg_match('/^[a-z]+(?:\s|$)/u', $text)) $text = mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);   /* never "ReMarkable" */
    return ['text' => $text, 'date' => $date->format('Y-m-d'), 'time' => $time];
}
function voSayDate(string $date, string $time = ''): string {
    $tz = jvTz(); $d = new DateTime($date . ' ' . ($time !== '' ? $time : '08:00'), $tz); $today = new DateTime('today', $tz);
    $diff = (int) $today->diff((clone $d)->setTime(0, 0))->format('%r%a');
    $day = $diff === 0 ? 'today' : ($diff === 1 ? 'tomorrow' : $d->format('l j F'));
    return $day . ($time !== '' ? ' at ' . voSayTime($d) : '');
}
function voSayTime(DateTime $d): string { $m = (int) $d->format('i'); $h = (int) $d->format('G'); if ($h === 12 && $m === 0) return 'noon'; return $d->format('g') . ($m ? ':' . $d->format('i') : '') . ' ' . ($h < 12 ? 'am' : 'pm'); }
function voRemind(string $text, string $date, string $time): array {
    $r = jvRemAdd($text, $date, $time, null, 'voice');
    if (!$r['ok']) return ['intent' => 'remind', 'say' => 'Not set: ' . $r['error']];
    $x = $r['reminder'];
    return ['intent' => 'remind', 'say' => 'Reminder set for ' . voSayDate($x['date'], $x['time']) . ': ' . rtrim($x['text'], '.') . '.' . ($r['calendar'] ? ' It is on your calendar too.' : '')];
}
/** "add lunch with Nolan to my calendar Friday at noon": on the calendar when it can be written; otherwise a reminder, and it says so */
function voCalendar(string $s): array {
    $w = voWhen($s);
    if (!$w) return ['intent' => 'calendar-what', 'say' => 'What day? Say it like: add lunch with Nolan to my calendar Friday at noon.'];
    $acc = jvCalAccount(true);
    if ($acc) {
        $tok = gToken((string) $acc['email']);
        if ($tok) {
            $tz = jvTz(); $ev = ['summary' => $w['text'], 'description' => 'Added by voice through J.A.R.V.I.S.'];
            if ($w['time'] === '') { $ev['start'] = ['date' => $w['date']]; $ev['end'] = ['date' => (new DateTime($w['date'], $tz))->modify('+1 day')->format('Y-m-d')]; }
            else { $st = new DateTime($w['date'] . ' ' . $w['time'], $tz); $ev['start'] = ['dateTime' => $st->format(DATE_RFC3339), 'timeZone' => 'America/Denver']; $ev['end'] = ['dateTime' => (clone $st)->modify('+60 minutes')->format(DATE_RFC3339), 'timeZone' => 'America/Denver']; }
            $res = http('POST', jvCalBase() . 'calendars/primary/events', null, $ev, ['Authorization: Bearer ' . $tok]);
            if ((string) ($res['id'] ?? '') !== '') {
                @unlink(aDataDir() . '/jarvis/cal-cache.json'); alog('voice calendar event', ['date' => $w['date']]);
                return ['intent' => 'calendar', 'say' => 'On your ' . ($acc['label'] ?? 'Traverse') . ' calendar: ' . rtrim($w['text'], '.') . ', ' . voSayDate($w['date'], $w['time']) . '.'];
            }
            alog('voice calendar add failed', ['status' => (int) ($res['_status'] ?? 0)]);
        }
    }
    $r = jvRemAdd($w['text'], $w['date'], $w['time'], null, 'voice');
    if (!$r['ok']) return ['intent' => 'calendar-reminder', 'say' => 'Not saved: ' . $r['error']];
    return ['intent' => 'calendar-reminder', 'say' => 'Your calendar is ' . (jvCalAccount() ? 'connected read only' : 'not connected') . ', so I saved it as a reminder for ' . voSayDate($w['date'], $w['time']) . ': ' . rtrim($w['text'], '.') . '. To put things on the calendar itself, connect the calendar again in J.A.R.V.I.S.'];
}
function voGroceries(string $what): array {
    $texts = array_values(array_filter(array_map(fn($x) => groClean((string) $x, 120), preg_split('/\s*,\s*|\s+and\s+/iu', trim($what))), fn($x) => mb_strlen($x) >= 2));
    if (!$texts) return ['intent' => 'groceries', 'say' => 'What should go on the list?'];
    $picks = jget('gro-picks.json'); $full = false;
    $list = groEdit(function ($items) use ($texts, $picks, &$full) {
        if (count($items) + count($texts) > 300) { $full = true; return $items; }
        foreach ($texts as $t) { $it = ['id' => bin2hex(random_bytes(6)), 'text' => $t, 'done' => false, 'by' => 'Matthew', 'at' => time()]; $p = $picks[groNorm($t)] ?? null; if (is_array($p)) $it['pick'] = $p + ['at' => 0]; $items[] = $it; }
        return $items;
    });
    if ($full) return ['intent' => 'groceries', 'say' => 'The grocery list is full. Clear the checked items first.'];
    $n = count(array_filter($list['items'], fn($i) => empty($i['done'])));
    return ['intent' => 'groceries', 'say' => 'Added ' . voJoin($texts) . ' to the grocery list. ' . $n . ' on the list now.'];
}
function voJoin(array $l): string { $l = array_values($l); $n = count($l); return $n <= 1 ? (string) ($l[0] ?? '') : implode(', ', array_slice($l, 0, -1)) . ' and ' . $l[$n - 1]; }
function voPlural(int $n, string $one, string $many = ''): string { return $n . ' ' . ($n === 1 ? $one : ($many !== '' ? $many : $one . 's')); }

/* ---------------------------------------------------------------- the quick reads, said aloud */
function voStatusFile(): array { $f = aDataDir() . '/jarvis/status.json'; $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null; return is_array($j) ? $j : []; }
function voNeeds(): array {
    $l = array_values(array_filter(jget('items.json'), fn($i) => is_array($i) && ($i['status'] ?? 'open') === 'open' && ($i['category'] ?? '') === 'needs_reply'));
    usort($l, fn($a, $b) => ((($b['priority'] ?? '') === 'high') <=> (($a['priority'] ?? '') === 'high')) ?: ((int) $b['date'] <=> (int) $a['date']));
    return $l;
}
function voNames(array $items, int $n = 3): string { $names = []; foreach ($items as $i) { $x = trim((string) ($i['from'] ?? '')); if ($x !== '' && !in_array($x, $names, true)) $names[] = $x; if (count($names) >= $n) break; } return voJoin($names); }
function voDecisions(): int { return count(array_filter(jvWaiting(voStatusFile()), fn($w) => empty($w['decided']))); }
/** one day of the calendar: 0 today, 1 tomorrow */
function voDay(int $plus): string {
    $tz = jvTz(); $day = (new DateTime('today', $tz))->modify('+' . $plus . ' days')->format('Y-m-d'); $label = $plus ? 'tomorrow' : 'today';
    $c = jvCalendar(); $parts = [];
    if (!empty($c['error'])) $parts[] = 'The calendar did not answer: ' . rtrim((string) $c['error'], '.') . '.';
    elseif (($c['source'] ?? '') === 'none') $parts[] = 'Your calendar is not connected to J.A.R.V.I.S.';
    else {
        $ev = array_values(array_filter((array) ($c['events'] ?? []), fn($e) => substr((string) $e['start'], 0, 10) === $day));
        $parts[] = $ev ? 'On your calendar ' . $label . ': ' . implode('; ', array_map(fn($e) => (!empty($e['allDay']) ? 'all day, ' : voSayTime((new DateTime((string) $e['start']))->setTimezone($tz)) . ', ') . $e['title'], array_slice($ev, 0, 6))) . '.'
            : 'Nothing on your calendar ' . $label . '.';
    }
    $rem = array_values(array_filter(jvReminders(), fn($r) => $r['state'] === 'open' && $r['date'] === $day));
    if ($rem) $parts[] = 'Reminders ' . $label . ': ' . implode(' ', array_map(fn($r) => rtrim($r['text'], '.') . '.', array_slice($rem, 0, 4)));
    return implode(' ', $parts);
}
function voBrief(): string {
    $tz = jvTz(); $h = (int) (new DateTime('now', $tz))->format('G');
    $L = [($h < 12 ? 'Good morning' : ($h < 17 ? 'Good afternoon' : 'Good evening')) . ', Matthew.', voDay(0)];
    $due = array_values(array_filter(jvReminders(), fn($r) => $r['state'] === 'open' && $r['due'] <= time() && $r['date'] !== (new DateTime('today', $tz))->format('Y-m-d')));
    if ($due) $L[] = 'Overdue: ' . implode(' ', array_map(fn($r) => rtrim($r['text'], '.') . '.', array_slice($due, 0, 3)));
    $soon = array_values(array_filter(jvReminders(), fn($r) => $r['state'] === 'open' && $r['due'] > time() + 3600 && $r['due'] < time() + 3 * 86400 && $r['date'] !== (new DateTime('today', $tz))->format('Y-m-d')));
    if ($soon) $L[] = 'Coming up: ' . implode('; ', array_map(fn($r) => (new DateTime($r['date'], $tz))->format('l') . ', ' . rtrim(mb_substr($r['text'], 0, 70), '.'), array_slice($soon, 0, 3))) . '.';
    $nr = voNeeds(); $L[] = $nr ? voPlural(count($nr), 'email needs', 'emails need') . ' a reply, from ' . voNames($nr) . '.' : 'No email needs a reply.';
    $d = voDecisions(); if ($d) $L[] = voPlural($d, 'decision') . ' waiting on you.';
    $me = count(array_filter(jdAll(), fn($t) => $t['status'] === 'matthew')); if ($me) $L[] = voPlural($me, 'desk chat needs', 'desk chats need') . ' you.';
    $b = jvStatus()['builds']; $run = array_filter($b, fn($x) => $x['state'] === 'running'); $done = array_filter($b, fn($x) => $x['state'] === 'done');
    if ($run || $done) $L[] = ($run ? voPlural(count($run), 'build') . ' running' : 'Nothing building') . ($done ? ', ' . count($done) . ' finished.' : '.');
    $o = jvStatus()['overnight']; if ($o && $o['problems']) $L[] = 'The overnight check found ' . voPlural(count($o['problems']), 'problem') . '.';
    return implode(' ', array_filter($L));
}
/** what changed since this key last asked (12 hours, the first time) */
function voNew(string $kid): string {
    $seenF = 'jarvis/voice-seen.json'; $since = (int) (jget($seenF)[$kid] ?? 0) ?: time() - 12 * 3600;
    $P = [];
    $nr = array_values(array_filter(voNeeds(), fn($i) => (int) $i['date'] > $since));
    if ($nr) $P[] = voPlural(count($nr), 'new email needs', 'new emails need') . ' a reply, from ' . voNames($nr) . '.';
    $all = voNeeds(); if (!$nr && $all) $P[] = voPlural(count($all), 'email is', 'emails are') . ' still waiting on a reply.';
    $ans = []; foreach (jdRows() as $r) if (($r['t'] ?? '') === 'reply' && in_array($r['status'] ?? '', ['answered', 'matthew'], true) && (int) ($r['at'] ?? 0) > $since) $ans[] = $r;
    if ($ans) { $last = end($ans); $first = (string) preg_replace('/\s+/u', ' ', (string) $last['text']); $one = preg_match('/^(.{10,160}?[.!?])(\s|$)/u', $first, $m) ? $m[1] : mb_substr($first, 0, 140);
        $P[] = voPlural(count($ans), 'desk answer') . ' since you last asked. The latest: ' . voSpeakable($one); }
    $due = array_values(array_filter(jvReminders(), fn($r) => $r['state'] === 'open' && $r['due'] <= time()));
    if ($due) $P[] = 'Reminder' . (count($due) > 1 ? 's' : '') . ': ' . implode(' ', array_map(fn($r) => rtrim($r['text'], '.') . '.', array_slice($due, 0, 3)));
    $d = voDecisions(); if ($d) $P[] = voPlural($d, 'decision') . ' waiting on you.';
    $bd = array_filter(jvStatus()['builds'], fn($x) => $x['state'] !== 'running' && $x['at'] > $since);
    if ($bd) $P[] = implode('. ', array_map(fn($x) => $x['name'] . ($x['state'] === 'done' ? ' finished' : ' stopped'), array_slice($bd, 0, 3))) . '.';
    jedit($seenF, function ($a) use ($kid) { $a[$kid] = time(); return $a; });
    return $P ? implode(' ', $P) : 'Nothing new since you last asked.';
}
function voBuilds(): string {
    $b = jvStatus()['builds']; if (!$b) return 'Nothing is building right now.';
    $run = array_values(array_filter($b, fn($x) => in_array($x['state'], ['running', 'quiet'], true)));
    $done = array_values(array_filter($b, fn($x) => $x['state'] === 'done'));
    $P = [];
    if ($run) $P[] = voPlural(count($run), 'build') . ' running: ' . implode('; ', array_map(fn($x) => $x['name'] . ($x['pct'] !== null ? ', ' . $x['pct'] . ' percent' : ''), array_slice($run, 0, 3))) . '.';
    if ($done) $P[] = 'Finished: ' . implode('; ', array_map(fn($x) => $x['name'], array_slice($done, 0, 3))) . '.';
    return $P ? implode(' ', $P) : 'Nothing is building right now.';
}

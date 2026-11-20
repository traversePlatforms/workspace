"""Tests for the laptop wake word (2026-11-19). Run with the listener's own Python:
  %LOCALAPPDATA%\\JarvisWake\\venv\\Scripts\\python.exe assistant\\jarvis\\wakeword\\test_wake.py [--window] [--cpu]
What it checks, with no microphone input needed:
  - spoken "Hey Jarvis" clips (Windows' own voices, David and Zira, three speeds, and with background noise) wake it;
    other speech, "Hey Travis" and "Jarvis" inside a sentence do not;
  - in a long stream, it wakes once, at the right moment (the cool-down stops a double);
  - resting: the off file, and on battery under 20%; the Desktop on-off switch;
  - the microphone opens and gives 80 ms frames, and closes.
  --window: the whole action on a throwaway Chrome profile and a test page (never his J.A.R.V.I.S. window): no window, then a
            minimised one, then one behind Notepad: each time it comes to the front and the page gets F13 (and a user gesture).
  --cpu:    the listener's CPU use over 30 seconds of live listening.
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import struct as st
import urllib.parse
import urllib.request
import wave
from base64 import b64encode

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
import hey_jarvis as hj  # noqa: E402

PASS = FAIL = 0


def ok(c, what):
    global PASS, FAIL
    if c:
        PASS += 1
    else:
        FAIL += 1
        print('FAIL:', what)


TMP = tempfile.mkdtemp(prefix='jarvis-wake-')
TTS = r'''param([string]$Text, [string]$Out, [string]$Voice, [int]$Rate)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($Voice); $s.Rate = $Rate
$s.SetOutputToWaveFile($Out, (New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)))
$s.Speak($Text); $s.Dispose()
'''
open(os.path.join(TMP, 'tts.ps1'), 'w').write(TTS)


def say(text, voice, rate, name):
    out = os.path.join(TMP, name + '.wav')
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(TMP, 'tts.ps1'), '-Text', text, '-Out', out,
                    '-Voice', 'Microsoft %s Desktop' % voice, '-Rate', str(rate)], check=True, capture_output=True)
    return out


def samples(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)


def write(path, a):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(np.clip(a, -32768, 32767).astype(np.int16).tobytes())
    return path


def noisy(path, snr_db, seed=1):
    a = samples(path)
    rng = np.random.default_rng(seed)
    n = rng.standard_normal(len(a)).astype(np.float32)
    p = float(np.mean(a[np.abs(a) > 200] ** 2)) if np.any(np.abs(a) > 200) else float(np.mean(a ** 2))
    n *= np.sqrt(p / (10 ** (snr_db / 10)) / float(np.mean(n ** 2)))
    return write(path.replace('.wav', '-snr%d.wav' % snr_db), a + n)


try:
    # ------------------------------------------------ 1. the phrase wakes it; other speech does not
    pos, neg = [], []
    for v in ('David', 'Zira'):
        for r in (-2, 0, 2):
            pos.append(say('Hey Jarvis.', v, r, 'hj-%s%d' % (v, r)))
        pos.append(say("Hey Jarvis, what's on today?", v, 0, 'hjq-%s' % v))
        neg.append(say("Hey there, what time is the meeting with Tyler tomorrow? Remind me to call Jen.", v, 0, 'n1-%s' % v))
        neg.append(say('Hey Travis, can you check the trailer lights before we leave?', v, 0, 'n2-%s' % v))
        neg.append(say('I watched the old movie with Jarvis in it last night, and then we went to bed.', v, 0, 'n3-%s' % v))
        neg.append(say('Hey Charles. The service area is forty five miles around Englewood.', v, 0, 'n4-%s' % v))
        neg.append(say('Hey Charlie, are you coming? Hey Marcus.', v, 0, 'n5-%s' % v))
    scores = {}
    for p in pos:
        best, hits = hj.score_wav(p)
        scores[os.path.basename(p)] = best
        ok(len(hits) == 1, '"Hey Jarvis" wakes it once: %s (best %.3f, %s)' % (os.path.basename(p), best, hits))
    for p in pos[:4]:
        for snr in (20, 10):
            q = noisy(p, snr)
            best, hits = hj.score_wav(q)
            scores[os.path.basename(q)] = best
            ok(len(hits) == 1, 'with background noise (SNR %d dB): %s wakes it (best %.3f)' % (snr, os.path.basename(p), best))
    for p in neg:
        best, hits = hj.score_wav(p)
        scores[os.path.basename(p)] = best
        ok(not hits, 'other speech does not wake it: %s (best %.3f)' % (os.path.basename(p), best))
    print('scores:', json.dumps({k: round(v, 3) for k, v in sorted(scores.items())}))

    # ------------------------------------------------ 2. a long stream: once, at the right moment
    a = np.concatenate([samples(neg[0]), np.zeros(8000, np.float32), samples(pos[1]), np.zeros(8000, np.float32), samples(neg[1]), samples(pos[1]) * 0.6, samples(neg[3])])
    at1 = (len(samples(neg[0])) + 8000) / 16000.0
    at2 = (len(samples(neg[0])) + 8000 + len(samples(pos[1])) + 8000 + len(samples(neg[1]))) / 16000.0
    best, hits = hj.score_wav(write(os.path.join(TMP, 'stream.wav'), a))
    ok(len(hits) == 2 and abs(hits[0] - at1) < 2.0 and abs(hits[1] - at2) < 2.0, 'a 30-second stream with the phrase twice: wakes twice, each near its moment (%s, said at %.1f and %.1f s)' % (hits, at1, at2))
    d = hj.Detector(0.5, 3.0, 3)
    s = samples(pos[1]).astype(np.int16)
    rep = np.concatenate([np.zeros(16000, np.int16), s, np.zeros(1600, np.int16), s, np.zeros(16000, np.int16)])
    n = sum(1 for i in range(0, len(rep) - 1280 + 1, 1280) if d.feed(rep[i:i + 1280], i / 16000.0) is not None)
    ok(n == 1, 'said twice within 3 seconds: the cool-down makes it one wake (%d)' % n)

    # ------------------------------------------------ 3. resting, and the on-off switch
    real_off = hj.OFF_FLAG
    hj.OFF_FLAG = os.path.join(TMP, 'off')
    c = hj.cfg()
    ok(hj.rest_reason(c, lambda: (False, 80)) is None, 'plugged in, switched on: it listens')
    ok(hj.rest_reason(c, lambda: (True, 19)) == 'battery', 'on battery under 20%: it rests')
    ok(hj.rest_reason(c, lambda: (True, 45)) is None and hj.rest_reason(c, lambda: (True, None)) is None, 'on battery above 20% (or unknown): it listens')
    open(hj.OFF_FLAG, 'w').close()
    ok(hj.rest_reason(c, lambda: (False, 80)) == 'off', 'the off file: it rests (mic closed)')
    hj.OFF_FLAG = real_off
    import toggle
    calls = []
    toggle.HOME, toggle.OFF_FLAG = TMP, os.path.join(TMP, 'off2')
    toggle.note = lambda t: calls.append(('note', t))
    toggle.running = lambda: False
    toggle.subprocess = type('S', (), {'run': staticmethod(lambda *a, **k: calls.append(('run', a[0]))), 'DEVNULL': None})
    toggle.main([])
    ok(os.path.exists(toggle.OFF_FLAG) and 'OFF' in calls[-1][1], 'Hey Jarvis on-off: first run turns it off, and says so')
    toggle.main([])
    ok(not os.path.exists(toggle.OFF_FLAG) and 'ON' in calls[-1][1] and ('run', ['schtasks', '/run', '/tn', 'Hey Jarvis']) in calls, 'Hey Jarvis on-off: again turns it on, and starts the listener if it is not running')

    # ------------------------------------------------ 4. the microphone (Windows' waveIn)
    if hj.winmm.waveInGetNumDevs() < 1:
        print('SKIP: no microphone on this machine')
    else:
        m = hj.Mic()
        t0, frames = time.monotonic(), []
        while time.monotonic() - t0 < 1.0:
            x = m.read(1000)
            if x is None:
                break
            frames.append(len(x))
        m.close()
        ok(len(frames) >= 10 and all(f == 2560 for f in frames), 'the microphone gives 80 ms frames (%d in 1 s) and closes' % len(frames))
        m2 = hj.Mic()
        ok(m2.read(1000) is not None, 'it opens again after closing (off, then on)')
        m2.close()

    # ------------------------------------------------ 5. the action, on a throwaway Chrome (opt-in: windows appear for a few seconds)
    if '--window' in sys.argv:
        prof = os.path.join(TMP, 'chrome')
        page = os.path.join(TMP, 'wake-test.html')
        open(page, 'w').write('<!doctype html><title>JARVIS-WAKE-TEST</title><body style="background:#03060c;color:#3ee8ff;font:24px sans-serif">wake test'
                              '<script>window.__keys=[];document.addEventListener("keydown",function(e){window.__keys.push(e.key);},true);</script>')
        sk = socket.socket()
        sk.bind(('127.0.0.1', 0))
        port = sk.getsockname()[1]
        sk.close()
        tc = dict(hj.cfg(), title='JARVIS-WAKE-TEST', url='file:///' + page.replace('\\', '/'), profile='Default', chime=False,
                  chrome_args=['--user-data-dir=' + prof, '--remote-debugging-port=%d' % port, '--no-first-run', '--no-default-browser-check'])

        def cdp_eval(expr):
            """Runtime.evaluate on the test page, over a bare websocket (no extra package)"""
            lst = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % port, timeout=5).read())
            t = [x for x in lst if x.get('type') == 'page' and 'wake-test' in x.get('url', '')][0]
            u = urllib.parse.urlparse(t['webSocketDebuggerUrl'])
            s = socket.create_connection((u.hostname, u.port), timeout=5)
            key = b64encode(os.urandom(16)).decode()
            s.sendall(('GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (u.path, u.hostname, u.port, key)).encode())
            hdr = b''
            while b'\r\n\r\n' not in hdr:
                hdr += s.recv(1)
            msg = json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}).encode()
            mask = os.urandom(4)
            head = bytes([0x81]) + (bytes([0x80 | len(msg)]) if len(msg) < 126 else bytes([0x80 | 126]) + st.pack('>H', len(msg)))
            s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(msg)))
            def rd(n):
                b = b''
                while len(b) < n:
                    b += s.recv(n - len(b))
                return b
            while True:
                h2 = rd(2)
                ln = h2[1] & 0x7F
                if ln == 126:
                    ln = st.unpack('>H', rd(2))[0]
                elif ln == 127:
                    ln = st.unpack('>Q', rd(8))[0]
                body = json.loads(rd(ln))
                if body.get('id') == 1:
                    s.close()
                    return body['result']['result'].get('value')
        chrome_pids = lambda: set(int(x.split(',')[1].strip('"')) for x in subprocess.run(['tasklist', '/fi', 'imagename eq chrome.exe', '/fo', 'csv', '/nh'], capture_output=True, text=True).stdout.splitlines() if x.startswith('"chrome.exe"'))
        before = chrome_pids()
        try:
            ok(hj.find_window('JARVIS-WAKE-TEST') is None, 'window: none open at the start')
            r1 = hj.act(tc)
            time.sleep(0.6)
            ok('opened' in r1 and 'listening' in r1, 'no window: Chrome opens it, brings it forward and sends F13 (%s)' % r1)
            ok(cdp_eval('JSON.stringify([window.__keys, navigator.userActivation.hasBeenActive])') == '[["F13"],true]', 'the page got F13, and counts it as a user gesture (so it may talk back)')
            hw = hj.find_window('JARVIS-WAKE-TEST')
            hj.user32.ShowWindow(hw, 6)   # SW_MINIMIZE
            time.sleep(0.6)
            r2 = hj.act(tc)
            time.sleep(0.5)
            ok('open window' in r2 and 'listening' in r2 and cdp_eval('window.__keys.length') == 2, 'minimised: it comes back up and gets F13 (%s)' % r2)
            np_ = subprocess.Popen(['notepad.exe'])
            time.sleep(2.5)
            fg_before = hj.user32.GetForegroundWindow()
            r3 = hj.act(tc)
            time.sleep(0.5)
            got = cdp_eval('window.__keys.length')
            ok(fg_before != hw and 'listening' in r3 and got == 3, 'behind another app (Notepad in front): it comes forward and gets F13 (%s, keys %s)' % (r3, got))
            subprocess.run(['taskkill', '/f', '/im', 'notepad.exe'], capture_output=True)
        finally:
            for pid in chrome_pids() - before:
                subprocess.run(['taskkill', '/f', '/t', '/pid', str(pid)], capture_output=True)

    # ------------------------------------------------ 6. CPU use while listening (opt-in: 30 s of live listening)
    if '--cpu' in sys.argv:
        hj.below_normal()
        d, m = hj.Detector(0.5, 3.0, 3), hj.Mic()     # the listener's own loop, in this process, so its CPU time is measured exactly
        t0, c0, n = time.monotonic(), time.process_time(), 0
        while time.monotonic() - t0 < 30:
            x = m.read(1000)
            if x is None:
                break
            d.feed(np.frombuffer(x, dtype=np.int16), time.monotonic())
            n += 1
        m.close()
        cores = os.cpu_count() or 1
        pct = (time.process_time() - c0) / (time.monotonic() - t0) * 100
        ok(n >= 350, 'live: %d frames in 30 s (none dropped)' % n)
        print('CPU: %.1f%% of one core, %.2f%% of the whole laptop (%d cores)' % (pct, pct / cores, cores))
        ok(pct < 25, 'listening uses under a quarter of one core (%.1f%%)' % pct)
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print('\n%d passed, %d failed' % (PASS, FAIL))
sys.exit(1 if FAIL else 0)

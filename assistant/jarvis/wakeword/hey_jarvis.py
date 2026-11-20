"""Hey Jarvis, the laptop's wake word (2026-11-19; Matthew: "build out all the voice actions we can use to allow me to talk to
jarvis easily. id rather not use siri to contact jarvis").

Listens on this laptop's microphone for "hey jarvis" with openWakeWord (free and open source; its own pretrained hey_jarvis model,
run by onnxruntime on the ARM64 CPU). The sound never leaves the laptop and nothing is kept: 80 ms at a time goes through the model
and is dropped. Nothing is sent anywhere until the phrase is heard, and then only what the J.A.R.V.I.S. page itself does.

When it hears the phrase: a short chime, then the J.A.R.V.I.S. window comes to the front already listening. An open window is
brought forward and given the F13 key, which the page takes as "listen now" (a key press also lets the page talk back). With none
open, Chrome opens it (Profile 4, as an app window) at ?listen=1, and it gets the same F13 once it is up.

Off: the file %LOCALAPPDATA%\\JarvisWake\\off (the Desktop shortcut "Hey Jarvis on-off" makes or removes it); the microphone is closed
while it is off. On battery under 20% it rests the same way. Runs at logon as the scheduled task "Hey Jarvis" (hidden, below-normal
priority, one copy at a time). Log: %LOCALAPPDATA%\\JarvisWake\\wake.log (start, stop, detections, errors; never sound).

  pythonw hey_jarvis.py                 run (the scheduled task)
  python hey_jarvis.py --wav f.wav      score a recording (16 kHz mono 16-bit), print the best score and any detections, exit
  python hey_jarvis.py --once           listen until the first detection, act on it, exit (a live check)
  python hey_jarvis.py --act            act as if it heard the phrase (chime, window, F13), exit
  python hey_jarvis.py --make-assets    write chime.wav and jarvis.ico into %LOCALAPPDATA%\\JarvisWake
  python hey_jarvis.py --status         print state.json
"""
import ctypes
import json
import math
import os
import struct
import subprocess
import sys
import threading
import time
import wave
from ctypes import wintypes as W

HOME = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'JarvisWake')
OFF_FLAG = os.path.join(HOME, 'off')
STATE = os.path.join(HOME, 'state.json')
LOG = os.path.join(HOME, 'wake.log')
CHIME = os.path.join(HOME, 'chime.wav')
CONFIG = os.path.join(HOME, 'config.json')
DEFAULTS = {
    'threshold': 0.5,                 # openWakeWord's own suggested starting point; raise it in config.json if it wakes by mistake
    'cooldown': 3.0,                  # seconds after a detection before it can fire again
    'patience': 3,                    # frames in a row at or over the threshold (3 = 240 ms): a real "hey jarvis" holds 8 or more,
                                      # a sound-alike ("hey Charles", "hey Travis") spikes for one (tested 19 Nov)
    'url': 'https://traverseplatforms.com/a-e018bb82/jarvis/?listen=1',
    'chrome': r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'profile': 'Profile 4',           # the Chrome profile J.A.R.V.I.S. and the hub are signed in to
    'title': 'J.A.R.V.I.S.',          # the page's <title>: how its window is found
    'battery_floor': 20,              # on battery below this percent, rest (mic closed)
    'chime': True,
}
FRAME = 1280                          # 80 ms at 16 kHz: what openWakeWord takes at a time


def cfg():
    c = dict(DEFAULTS)
    try:
        with open(CONFIG, encoding='utf-8') as f:
            c.update({k: v for k, v in json.load(f).items() if k in DEFAULTS})
    except (OSError, ValueError):
        pass
    return c


def log(msg):
    try:
        os.makedirs(HOME, exist_ok=True)
        if os.path.exists(LOG) and os.path.getsize(LOG) > 256 * 1024:   # keep it small: the last half
            with open(LOG, 'rb') as f:
                f.seek(-128 * 1024, 2)
                tail = f.read()
            with open(LOG, 'wb') as f:
                f.write(tail[tail.find(b'\n') + 1:])
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S') + '  ' + msg + '\n')
    except OSError:
        pass


def write_state(state, **extra):
    try:
        os.makedirs(HOME, exist_ok=True)
        old = read_state()
        d = {'state': state, 'since': int(time.time()) if old.get('state') != state else old.get('since', int(time.time())), 'pid': os.getpid(),
             'lastHeard': old.get('lastHeard', 0), 'heard': old.get('heard', 0)}
        d.update(extra)
        tmp = STATE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(d, f)
        os.replace(tmp, STATE)
    except OSError:
        pass


def read_state():
    try:
        with open(STATE, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


# ---------------------------------------------------------------- the detector (openWakeWord), kept apart so a test can feed it
class Detector:
    def __init__(self, threshold=0.5, cooldown=3.0, patience=3):
        from openwakeword.model import Model
        self.model = Model(wakeword_models=['hey_jarvis'], inference_framework='onnx')
        self.key = next(iter(self.model.models))
        self.threshold = float(threshold)
        self.cooldown = float(cooldown)
        self.patience = max(1, int(patience))
        self.run = 0
        self.quiet_until = -1.0
        self.last = 0.0

    def feed(self, chunk, now):
        """chunk: 1280 int16 samples (numpy). Returns the score when it fires, else None."""
        s = float(self.model.predict(chunk)[self.key])
        self.last = s
        self.run = self.run + 1 if s >= self.threshold else 0
        if now < self.quiet_until:
            return None
        if self.run >= self.patience:
            self.quiet_until = now + self.cooldown
            self.run = 0
            self.model.reset()
            return s
        return None


def score_wav(path, threshold=0.5, cooldown=3.0, patience=3):
    """best score and detection times (seconds) for a 16 kHz mono 16-bit file, with a second of quiet on each side"""
    import numpy as np
    with wave.open(path, 'rb') as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError('needs 16 kHz mono 16-bit')
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    a = np.concatenate([np.zeros(16000, np.int16), a, np.zeros(16000, np.int16)])
    d = Detector(threshold, cooldown, patience)
    best, hits = 0.0, []
    for i in range(0, len(a) - FRAME + 1, FRAME):
        t = i / 16000.0
        h = d.feed(a[i:i + FRAME], t)
        best = max(best, d.last)
        if h is not None:
            hits.append(round(t - 1.0, 2))
    return best, hits


# ---------------------------------------------------------------- the microphone, through Windows' own waveIn (winmm): no PortAudio
# build is needed on ARM64, and closing it really closes the device (the mic light goes off)
winmm = ctypes.WinDLL('winmm')
k32 = ctypes.WinDLL('kernel32', use_last_error=True)
user32 = ctypes.WinDLL('user32', use_last_error=True)


class WAVEFORMATEX(ctypes.Structure):
    _fields_ = [('wFormatTag', W.WORD), ('nChannels', W.WORD), ('nSamplesPerSec', W.DWORD), ('nAvgBytesPerSec', W.DWORD),
                ('nBlockAlign', W.WORD), ('wBitsPerSample', W.WORD), ('cbSize', W.WORD)]


class WAVEHDR(ctypes.Structure):
    pass


WAVEHDR._fields_ = [('lpData', ctypes.c_void_p), ('dwBufferLength', W.DWORD), ('dwBytesRecorded', W.DWORD), ('dwUser', ctypes.c_size_t),
                    ('dwFlags', W.DWORD), ('dwLoops', W.DWORD), ('lpNext', ctypes.POINTER(WAVEHDR)), ('reserved', ctypes.c_size_t)]
HWAVEIN = ctypes.c_void_p
winmm.waveInOpen.argtypes = [ctypes.POINTER(HWAVEIN), ctypes.c_uint, ctypes.POINTER(WAVEFORMATEX), ctypes.c_size_t, ctypes.c_size_t, W.DWORD]
for _n in ('waveInPrepareHeader', 'waveInUnprepareHeader', 'waveInAddBuffer'):
    getattr(winmm, _n).argtypes = [HWAVEIN, ctypes.POINTER(WAVEHDR), ctypes.c_uint]
for _n in ('waveInStart', 'waveInStop', 'waveInReset', 'waveInClose'):
    getattr(winmm, _n).argtypes = [HWAVEIN]
for _n in ('waveInOpen', 'waveInPrepareHeader', 'waveInUnprepareHeader', 'waveInAddBuffer', 'waveInStart', 'waveInStop', 'waveInReset', 'waveInClose'):
    getattr(winmm, _n).restype = ctypes.c_uint
winmm.waveInGetNumDevs.restype = ctypes.c_uint
k32.CreateEventW.restype = W.HANDLE
k32.CreateEventW.argtypes = [ctypes.c_void_p, W.BOOL, W.BOOL, W.LPCWSTR]
k32.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]
k32.WaitForSingleObject.restype = W.DWORD
k32.CloseHandle.argtypes = [W.HANDLE]
WAVE_MAPPER, CALLBACK_EVENT, WHDR_DONE = 0xFFFFFFFF, 0x50000, 1


class Mic:
    def __init__(self, nbuf=8):
        self.h = HWAVEIN()
        self.ev = k32.CreateEventW(None, False, False, None)
        fmt = WAVEFORMATEX(1, 1, 16000, 32000, 2, 16, 0)
        r = winmm.waveInOpen(ctypes.byref(self.h), WAVE_MAPPER, ctypes.byref(fmt), self.ev, 0, CALLBACK_EVENT)
        if r:
            k32.CloseHandle(self.ev)
            raise OSError('the microphone did not open (waveInOpen %d): is one connected, and is "Let desktop apps access your microphone" on?' % r)
        self.bufs = [ctypes.create_string_buffer(FRAME * 2) for _ in range(nbuf)]
        self.hdrs = [WAVEHDR() for _ in range(nbuf)]
        for b, hd in zip(self.bufs, self.hdrs):
            hd.lpData = ctypes.cast(b, ctypes.c_void_p)
            hd.dwBufferLength = FRAME * 2
            winmm.waveInPrepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(WAVEHDR))
            winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(WAVEHDR))
        self.i = 0
        winmm.waveInStart(self.h)

    def read(self, timeout_ms=1000):
        """the next 80 ms (bytes), or None after timeout_ms with nothing"""
        hd = self.hdrs[self.i]
        end = time.monotonic() + timeout_ms / 1000.0
        while not (hd.dwFlags & WHDR_DONE):
            left = int((end - time.monotonic()) * 1000)
            if left <= 0:
                return None
            k32.WaitForSingleObject(self.ev, min(left, 200))
        data = ctypes.string_at(self.bufs[self.i], hd.dwBytesRecorded)
        hd.dwFlags &= ~WHDR_DONE
        winmm.waveInAddBuffer(self.h, ctypes.byref(hd), ctypes.sizeof(WAVEHDR))
        self.i = (self.i + 1) % len(self.hdrs)
        return data

    def close(self):
        try:
            winmm.waveInReset(self.h)
            for hd in self.hdrs:
                winmm.waveInUnprepareHeader(self.h, ctypes.byref(hd), ctypes.sizeof(WAVEHDR))
            winmm.waveInClose(self.h)
        finally:
            k32.CloseHandle(self.ev)


# ---------------------------------------------------------------- when to rest
class SYSTEM_POWER_STATUS(ctypes.Structure):
    _fields_ = [('ACLineStatus', ctypes.c_ubyte), ('BatteryFlag', ctypes.c_ubyte), ('BatteryLifePercent', ctypes.c_ubyte),
                ('SystemStatusFlag', ctypes.c_ubyte), ('BatteryLifeTime', W.DWORD), ('BatteryFullLifeTime', W.DWORD)]


def battery():
    """(on battery, percent or None)"""
    s = SYSTEM_POWER_STATUS()
    if not k32.GetSystemPowerStatus(ctypes.byref(s)):
        return False, None
    return s.ACLineStatus == 0, (None if s.BatteryLifePercent == 255 else int(s.BatteryLifePercent))


def rest_reason(c, power=battery):
    if os.path.exists(OFF_FLAG):
        return 'off'
    on_batt, pct = power()
    if on_batt and pct is not None and pct < int(c['battery_floor']):
        return 'battery'
    return None


# ---------------------------------------------------------------- the action: chime, the window, F13
def make_assets():
    """chime.wav (two soft rising tones) and jarvis.ico (the J.A.R.V.I.S. halo icon, for the Desktop shortcut)"""
    os.makedirs(HOME, exist_ok=True)
    rate, frames = 22050, bytearray()
    for f0, dur in ((660.0, 0.11), (990.0, 0.16)):
        n = int(rate * dur)
        for i in range(n):
            env = min(1.0, i / (rate * 0.01)) * math.exp(-4.0 * i / n)
            frames += struct.pack('<h', int(9000 * env * (math.sin(2 * math.pi * f0 * i / rate) + 0.25 * math.sin(4 * math.pi * f0 * i / rate))))
    with wave.open(CHIME, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    png = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icon-192.png')
    if os.path.exists(png):
        data = open(png, 'rb').read()
        ico = struct.pack('<HHH', 0, 1, 1) + struct.pack('<BBBBHHII', 192, 192, 0, 0, 1, 32, len(data), 22) + data   # an ICO holding one PNG
        with open(os.path.join(HOME, 'jarvis.ico'), 'wb') as f:
            f.write(ico)


def chime(c):
    if not c.get('chime', True):
        return
    try:
        import winsound
        if not os.path.exists(CHIME):
            make_assets()
        winsound.PlaySound(CHIME, winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT)
    except Exception as e:  # a missing sound never stops the wake
        log('chime: %s' % e)


EnumWindowsProc = ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
user32.EnumWindows.argtypes = [EnumWindowsProc, W.LPARAM]
user32.GetWindowTextW.argtypes = [W.HWND, W.LPWSTR, ctypes.c_int]
user32.GetWindowTextLengthW.argtypes = [W.HWND]
user32.GetClassNameW.argtypes = [W.HWND, W.LPWSTR, ctypes.c_int]
user32.IsWindowVisible.argtypes = [W.HWND]
user32.IsIconic.argtypes = [W.HWND]
user32.ShowWindow.argtypes = [W.HWND, ctypes.c_int]
user32.SetForegroundWindow.argtypes = [W.HWND]
user32.BringWindowToTop.argtypes = [W.HWND]
user32.GetForegroundWindow.restype = W.HWND
user32.GetWindowThreadProcessId.argtypes = [W.HWND, ctypes.POINTER(W.DWORD)]
user32.GetWindowThreadProcessId.restype = W.DWORD
user32.AttachThreadInput.argtypes = [W.DWORD, W.DWORD, W.BOOL]
user32.keybd_event.argtypes = [ctypes.c_ubyte, ctypes.c_ubyte, W.DWORD, ctypes.c_size_t]
VK_F13, VK_MENU, KEYUP = 0x7C, 0x12, 0x0002


def find_window(title):
    """the visible Chrome window whose title starts with the page's title (an app window, or a browser window on that tab)"""
    found = []

    def cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            n = user32.GetWindowTextLengthW(hwnd)
            if n:
                b = ctypes.create_unicode_buffer(n + 1)
                user32.GetWindowTextW(hwnd, b, n + 1)
                if b.value.startswith(title):
                    cls = ctypes.create_unicode_buffer(64)
                    user32.GetClassNameW(hwnd, cls, 64)
                    if cls.value.startswith('Chrome_WidgetWin'):
                        found.append(hwnd)
        return True
    user32.EnumWindows(EnumWindowsProc(cb), 0)
    return found[0] if found else None


def focus(hwnd):
    """bring the window to the front; True only if it really is in front (a key is never sent to anything else)"""
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)          # SW_RESTORE
    if user32.GetForegroundWindow() == hwnd:
        return True
    fg = user32.GetForegroundWindow()
    me = k32.GetCurrentThreadId()
    other = user32.GetWindowThreadProcessId(fg, None) if fg else 0
    attached = bool(other and other != me and user32.AttachThreadInput(me, other, True))
    try:
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
    finally:
        if attached:
            user32.AttachThreadInput(me, other, False)
    if user32.GetForegroundWindow() == hwnd:
        return True
    # Windows' foreground lock: a key press from this program lets it hand the front over. Alt is the usual one; pressed and
    # released straight away it does nothing in the page.
    user32.keybd_event(VK_MENU, 0, 0, 0)
    user32.SetForegroundWindow(hwnd)
    user32.keybd_event(VK_MENU, 0, KEYUP, 0)
    time.sleep(0.05)
    return user32.GetForegroundWindow() == hwnd


def press_f13():
    user32.keybd_event(VK_F13, 0, 0, 0)
    user32.keybd_event(VK_F13, 0, KEYUP, 0)


def launch(c):
    flags = getattr(subprocess, 'DETACHED_PROCESS', 0) | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
    subprocess.Popen([c['chrome'], '--profile-directory=' + c['profile'], '--app=' + c['url']] + list(c.get('chrome_args', [])), close_fds=True, creationflags=flags,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def act(c):
    """what happens on "hey jarvis": returns what it did, for the log"""
    chime(c)
    hwnd = find_window(c['title'])
    how = 'open window'
    if not hwnd:
        try:
            launch(c)
        except OSError as e:
            return 'could not start Chrome: %s' % e
        how = 'opened'
        t = time.monotonic()
        while not hwnd and time.monotonic() - t < 15:
            time.sleep(0.25)
            hwnd = find_window(c['title'])
        if not hwnd:
            return 'Chrome started, but no J.A.R.V.I.S. window came up in 15 s'
        time.sleep(1.2)                     # its script is running by now; an early F13 is kept until the page is ready anyway
    if focus(hwnd):
        press_f13()
        return how + ', in front, listening'
    return how + ', but Windows kept another window in front (no key sent)'


# ---------------------------------------------------------------- the loop
def single_instance():
    k32.CreateMutexW.restype = W.HANDLE
    k32.CreateMutexW.argtypes = [ctypes.c_void_p, W.BOOL, W.LPCWSTR]
    h = k32.CreateMutexW(None, False, 'Local\\HeyJarvisWakeWord')
    return h if ctypes.get_last_error() != 183 else None     # ERROR_ALREADY_EXISTS


def below_normal():
    try:
        k32.GetCurrentProcess.restype = W.HANDLE
        k32.SetPriorityClass.argtypes = [W.HANDLE, W.DWORD]
        k32.SetPriorityClass(k32.GetCurrentProcess(), 0x4000)   # BELOW_NORMAL_PRIORITY_CLASS
    except Exception:
        pass


def run(once=False):
    import numpy as np
    if not once and single_instance() is None:
        return 0
    below_normal()
    c = cfg()
    log('started (threshold %.2f, %d frames)' % (c['threshold'], c['patience']))
    det, mic, buf, last_check, waits, reason = None, None, b'', 0.0, 0, None
    try:
        while True:
            now = time.monotonic()
            if now - last_check > 1.0:
                last_check = now
                r = rest_reason(c)
                if r != reason:
                    reason = r
                    log('resting: ' + r if r else 'listening')
                if r:
                    if mic:
                        mic.close()
                        mic, buf = None, b''
                    write_state(r)
                    time.sleep(2)
                    continue
            if det is None:
                det = Detector(c['threshold'], c['cooldown'], c['patience'])
            if mic is None:
                try:
                    mic = Mic()
                    waits = 0
                    write_state('listening')
                except OSError as e:
                    log(str(e))
                    write_state('no-mic', error=str(e)[:200])
                    time.sleep(30)
                    continue
            data = mic.read(1000)
            if data is None:
                waits += 1
                if waits >= 5:                 # a headset unplugged, a device change: open it again
                    log('no sound for 5 s: opening the microphone again')
                    mic.close()
                    mic, buf = None, b''
                continue
            waits = 0
            buf += data
            while len(buf) >= FRAME * 2:
                chunk = np.frombuffer(buf[:FRAME * 2], dtype=np.int16)
                buf = buf[FRAME * 2:]
                hit = det.feed(chunk, time.monotonic())
                if hit is not None:
                    st = read_state()
                    write_state('listening', lastHeard=int(time.time()), heard=int(st.get('heard', 0)) + 1)
                    if once:
                        log('heard "hey jarvis" (%.2f): %s' % (hit, act(c)))
                        return 0
                    threading.Thread(target=lambda h=hit: log('heard "hey jarvis" (%.2f): %s' % (h, act(c))), daemon=True).start()
    except KeyboardInterrupt:
        return 0
    finally:
        if mic:
            mic.close()
        write_state('stopped')
        log('stopped')


def main(argv):
    if '--wav' in argv:
        c = cfg()
        best, hits = score_wav(argv[argv.index('--wav') + 1], c['threshold'], c['cooldown'], c['patience'])
        print(json.dumps({'best': round(best, 3), 'detections': hits}))
        return 0
    if '--make-assets' in argv:
        make_assets()
        return 0
    if '--act' in argv:
        print(act(cfg()))
        return 0
    if '--status' in argv:
        print(json.dumps(read_state()))
        return 0
    return run(once='--once' in argv)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

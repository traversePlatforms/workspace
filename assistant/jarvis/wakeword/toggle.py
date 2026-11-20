"""Hey Jarvis on-off (2026-11-19): the Desktop shortcut runs this. It makes or removes %LOCALAPPDATA%\\JarvisWake\\off, which the
listener (hey_jarvis.py) checks every second: off closes the microphone, on opens it again. Turning it on also starts the
scheduled task "Hey Jarvis" if the listener is not running. A small note says which it is now and closes itself after 3 seconds.
  pythonw toggle.py            flip it
  pythonw toggle.py on|off     set it
"""
import ctypes
import os
import subprocess
import sys

HOME = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'JarvisWake')
OFF_FLAG = os.path.join(HOME, 'off')


def running():
    """is a listener up? (its single-instance lock exists)"""
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.OpenMutexW.restype = ctypes.c_void_p
    k32.OpenMutexW.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_wchar_p]
    h = k32.OpenMutexW(0x00100000, False, 'Local\\HeyJarvisWakeWord')   # SYNCHRONIZE
    if h:
        k32.CloseHandle(ctypes.c_void_p(h))
        return True
    return False


def note(text):
    try:
        u = ctypes.WinDLL('user32')
        u.MessageBoxTimeoutW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint, ctypes.c_ushort, ctypes.c_uint32]
        u.MessageBoxTimeoutW(None, text, 'Hey Jarvis', 0x40 | 0x40000, 0, 3000)   # information icon, on top, 3 s
    except Exception:
        pass


def main(argv):
    os.makedirs(HOME, exist_ok=True)
    want = argv[0] if argv and argv[0] in ('on', 'off') else ('on' if os.path.exists(OFF_FLAG) else 'off')
    if want == 'off':
        open(OFF_FLAG, 'w').close()
        note('Hey Jarvis is OFF. The microphone is closed.\n\nRun "Hey Jarvis on-off" again to turn it back on.')
    else:
        if os.path.exists(OFF_FLAG):
            os.remove(OFF_FLAG)
        if not running():
            subprocess.run(['schtasks', '/run', '/tn', 'Hey Jarvis'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        note('Hey Jarvis is ON. Say "Hey Jarvis" near the laptop.\n\nIt listens on the laptop only; nothing leaves until it hears the phrase.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

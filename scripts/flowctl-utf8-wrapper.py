"""Wrapper to run flowctl.py with UTF-8 subprocess encoding on Windows."""
import subprocess
import sys
import os

# Force UTF-8 everywhere
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Monkey-patch subprocess.run to always use utf-8 encoding
_orig_run = subprocess.run
def patched_run(*args, **kwargs):
    if kwargs.get('text') and 'encoding' not in kwargs:
        kwargs['encoding'] = 'utf-8'
        kwargs['errors'] = 'replace'
    return _orig_run(*args, **kwargs)
subprocess.run = patched_run

# Also patch Popen for good measure
_orig_popen_init = subprocess.Popen.__init__
def patched_popen_init(self, *args, **kwargs):
    if kwargs.get('text') and 'encoding' not in kwargs:
        kwargs['encoding'] = 'utf-8'
        kwargs['errors'] = 'replace'
    return _orig_popen_init(self, *args, **kwargs)
subprocess.Popen.__init__ = patched_popen_init

# Now run flowctl with the remaining args
flowctl_path = r'C:\Users\jonag\.claude\plugins\marketplaces\gmickel-claude-marketplace\plugins\flow-next\scripts\flowctl.py'
sys.argv = [flowctl_path] + sys.argv[1:]

with open(flowctl_path, encoding='utf-8') as f:
    code = f.read()

exec(compile(code, flowctl_path, 'exec'))

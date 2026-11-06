#!/usr/bin/env python3
"""Compare env vars read by the code with keys in env/*.example. Run from the devGnani folder."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
have = set()
for f in (root / "env").glob("*.example"):
    for l in f.read_text().splitlines():
        m = re.match(r"\s*#?\s*([A-Z][A-Z0-9_]+)=", l)
        if m and not l.lstrip().startswith("# "): have.add(m.group(1))
        elif m: have.add(m.group(1))
pats = [
 (r'os\.environ\.get\(\s*["\']([A-Z][A-Z0-9_]+)["\']\s*(,)?', 'py'),
 (r'os\.getenv\(\s*["\']([A-Z][A-Z0-9_]+)["\']\s*(,)?', 'py'),
 (r'os\.environ\[\s*["\']([A-Z][A-Z0-9_]+)["\']\s*\]', 'py-required'),
 (r'(?:env_bool|env_int|env_float|env_str|_env)\(\s*["\']([A-Z][A-Z0-9_]+)["\']\s*(,)?', 'py'),
 (r'process\.env\.([A-Z][A-Z0-9_]+)', 'node'),
 (r'import\.meta\.env\.([A-Z][A-Z0-9_]+)', 'vite'),
]
use = {}
skip = {"node_modules", "__pycache__", "dist", "build", ".git", "tests", "test"}
for p in root.rglob("*"):
    if p.is_dir() or p.suffix not in {".py", ".mjs", ".js", ".ts", ".tsx"}: continue
    if any(s in p.parts for s in skip) or p.parts[0 if False else 0] == "env": continue
    try: t = p.read_text(errors="ignore")
    except Exception: continue
    for rx, kind in pats:
        for m in re.finditer(rx, t):
            name = m.group(1)
            d = use.setdefault(name, {"files": set(), "kinds": set(), "default": False})
            d["files"].add(str(p.relative_to(root))); d["kinds"].add(kind)
            if kind == "py" and m.lastindex and m.lastindex >= 2 and m.group(2): d["default"] = True
sysvars = {"PATH","HOME","PWD","USER","HOSTNAME","LANG","TZ","NODE_ENV","PYTHONPATH","PYTHONUNBUFFERED","CI","DEBUG","PORT","SERVICE","MODE","DEV","PROD","SSR","BASE_URL"}
missing = sorted(n for n in use if n not in have and n not in sysvars)
print(f"keys in env examples: {len(have)}   variables read by code: {len(use)}   not in examples: {len(missing)}\n")
for n in missing:
    d = use[n]
    flag = "has-default" if d["default"] else ("REQUIRED?" if "py-required" in d["kinds"] else "check")
    fl = sorted(d["files"])
    print(f"{n:38} {flag:12} {','.join(sorted(d['kinds'])):12} {fl[0]}" + (f"  (+{len(fl)-1})" if len(fl) > 1 else ""))
unused = sorted(k for k in have if k not in use)
print(f"\nin examples but not read by code directly ({len(unused)}): " + ", ".join(unused))

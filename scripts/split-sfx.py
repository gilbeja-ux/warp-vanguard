#!/usr/bin/env python3
"""Split a multi-take SFX library file into individual one-shots.

Library WAVs usually pack many takes back-to-back with silence between
them. This finds the gaps with ffmpeg's silencedetect and cuts each take
into its own file, padded slightly so transients aren't clipped.

Usage:
  python3 scripts/split-sfx.py <input.(wav|mp3|flac)> [outdir]
      [--thresh -45] [--minsil 0.25] [--minlen 0.06]

  --thresh  silence threshold in dB (raise toward -30 for noisy packs)
  --minsil  minimum silence gap in seconds that separates two takes
  --minlen  discard slivers shorter than this
Output files are named  <stem>-NN_<duration>s.wav  for easy auditioning
(select in Finder and press Space to preview).
"""
import re, subprocess, sys, os

def main():
    args = [a for a in sys.argv[1:]]
    def opt(name, default):
        if name in args:
            i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return float(v)
        return default
    thresh = opt('--thresh', -45.0)
    minsil = opt('--minsil', 0.25)
    minlen = opt('--minlen', 0.06)
    if not args:
        print(__doc__); sys.exit(1)
    src = args[0]
    outdir = args[1] if len(args) > 1 else os.path.splitext(src)[0] + '-split'
    os.makedirs(outdir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(src))[0]

    # find silences
    r = subprocess.run(
        ['ffmpeg', '-i', src, '-af', f'silencedetect=noise={thresh}dB:d={minsil}',
         '-f', 'null', '-'], capture_output=True, text=True)
    log = r.stderr
    starts = [float(m) for m in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(m) for m in re.findall(r'silence_end: ([\d.]+)', log)]
    dur_m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', log)
    total = int(dur_m[1]) * 3600 + int(dur_m[2]) * 60 + float(dur_m[3]) if dur_m else 0

    # sound regions = gaps between silences
    regions, cur = [], 0.0
    for s, e in zip(starts, ends + [total]):
        if s - cur > minlen: regions.append((cur, s))
        cur = e
    if total - cur > minlen: regions.append((cur, total))

    pad = 0.03
    n = 0
    for a, b in regions:
        a2, b2 = max(0, a - pad), min(total, b + pad)
        if b2 - a2 < minlen: continue
        n += 1
        out = os.path.join(outdir, f'{stem}-{n:02d}_{b2 - a2:.2f}s.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                        '-ss', f'{a2:.3f}', '-to', f'{b2:.3f}', out], check=True)
        print(f'  {os.path.basename(out)}')
    print(f'\n{n} takes -> {outdir}/')
    if n <= 1:
        print('Only one region found — try a higher threshold, e.g. --thresh -35')

if __name__ == '__main__':
    main()

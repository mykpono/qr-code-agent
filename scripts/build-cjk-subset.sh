#!/usr/bin/env bash
# Regenerate the self-hosted Japanese webfont: public/fonts/noto-sans-jp-<w>-japanese.woff2
#
#   bash scripts/build-cjk-subset.sh
#
# NOT part of `npm run build`. The output is committed, like public/assets/og.png,
# because it needs Python tooling that Vercel's build container does not have and
# the character set changes roughly never. Run it by hand and commit the result.
#
# ── Why a custom subset ────────────────────────────────────────────────────
# Google serves Noto Sans JP as 124 unicode-range chunks PER WEIGHT — about 18 MB
# across the four weights this site uses, which is not committable. A single
# frequency-bounded subset per weight is ~370 KB, and a kanji outside it degrades
# per-glyph rather than breaking the page.
#
# ── Character set ──────────────────────────────────────────────────────────
#   · the 2,136 Jōyō kanji (grades 1–8) — the official regular-use set
#   · the top ~1,200 kanji by Aozora corpus frequency (catches common non-Jōyō)
#   · all hiragana, katakana, CJK + full-width punctuation
#   · Latin, digits, currency, arrows and the design's glyph set (› ▴ ▾ ✓ ✕ …)
#   ≈ 3,745 codepoints.
#
# Latin is included as a per-glyph safety net only. The @font-face unicode-range
# in src/styles/tokens/fonts.css lists ONLY Japanese ranges, so Latin text keeps
# rendering in Space Grotesk and non-ja locales never fetch these files at all.
#
# ── Requirements ───────────────────────────────────────────────────────────
#   python3 -m venv .fontenv && .fontenv/bin/pip install fonttools brotli
# .fontenv/ is gitignored. Noto Sans JP is OFL, same licence as the other two
# families here.

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="${VENV:-.fontenv}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SRC="https://github.com/notofonts/noto-cjk/raw/main/Sans/Variable/TTF/Subset/NotoSansJP-VF.ttf"
WEIGHTS=(400 500 600 700)   # must match the Space Grotesk weights in fonts.css

for bin in "$VENV/bin/pyftsubset" "$VENV/bin/python"; do
  [ -x "$bin" ] || { echo "✗ missing $bin — see the Requirements block above"; exit 1; }
done

echo "→ downloading Noto Sans JP variable…"
curl -sL -o "$WORK/NotoSansJP.ttf" "$SRC"
[ -s "$WORK/NotoSansJP.ttf" ] || { echo "✗ download failed"; exit 1; }

echo "→ building character set…"
curl -sL -o "$WORK/kanji.json" https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json
curl -sL -o "$WORK/freq.json"  https://raw.githubusercontent.com/scriptin/topokanji/master/data/kanji-frequency/aozora.json
"$VENV/bin/python" - "$WORK" <<'PY'
import json,sys
w=sys.argv[1]
kanji=json.load(open(f'{w}/kanji.json',encoding='utf-8'))
joyo=[k for k,v in kanji.items() if isinstance(v.get('grade'),int) and 1<=v['grade']<=8]
assert len(joyo)==2136, f'expected 2136 Joyo kanji, got {len(joyo)} — source data changed'
freq=json.load(open(f'{w}/freq.json',encoding='utf-8'))
chars=set(joyo)|{r[0] for r in freq[1:1201] if len(r[0])==1}
for a,b in [(0x3000,0x303F),(0x3040,0x309F),(0x30A0,0x30FF),(0xFF00,0xFFEF),(0x31F0,0x31FF),
            (0x0020,0x024F),(0x2010,0x205E),(0x20A0,0x20BF),(0x2190,0x21FF),(0x2500,0x25FF)]:
    chars|={chr(c) for c in range(a,b+1)}
chars|=set('›▴▾✓✕↓♥⚠⏎×☕—–…「」『』【】〜・')
open(f'{w}/subset.txt','w',encoding='utf-8').write(''.join(sorted(chars)))
print(f'  {len(chars)} codepoints ({len(joyo)} Jōyō)')
PY

for wt in "${WEIGHTS[@]}"; do
  echo "→ weight $wt…"
  "$VENV/bin/python" -m fontTools.varLib.instancer "$WORK/NotoSansJP.ttf" "wght=$wt" -o "$WORK/inst.ttf" >/dev/null
  "$VENV/bin/pyftsubset" "$WORK/inst.ttf" \
    --output-file="public/fonts/noto-sans-jp-$wt-japanese.woff2" \
    --flavor=woff2 --text-file="$WORK/subset.txt" \
    --layout-features='kern,liga,palt,vert,locl' --no-hinting --desubroutinize
done

echo
ls -l public/fonts/noto-sans-jp-*.woff2 | awk '{printf "  %-42s %5.0f KB\n",$9,$5/1024}'
echo "✓ done — commit the .woff2 files. check-build.mjs asserts all four are served."

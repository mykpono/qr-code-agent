#!/usr/bin/env bash
# Regenerate the self-hosted CJK webfonts:
#   public/fonts/noto-sans-jp-<w>-japanese.woff2   (ja)
#   public/fonts/noto-sans-tc-<w>-zh-hant.woff2    (zh-tw)
#
#   bash scripts/build-cjk-subset.sh            # both
#   bash scripts/build-cjk-subset.sh ja
#   bash scripts/build-cjk-subset.sh zh-tw
#
# NOT part of `npm run build`. The output is committed, like public/assets/og.png,
# because it needs Python tooling that Vercel's build container does not have and
# the character set changes roughly never. Run it by hand and commit the result.
#
# ── Why a custom subset ────────────────────────────────────────────────────
# Google serves these families as ~100+ unicode-range chunks PER WEIGHT — many MB
# across the four weights this site uses, which is not committable. A single
# frequency-bounded subset per weight is a few hundred KB, and a character outside
# it degrades per-glyph rather than breaking the page.
#
# ── Character sets ─────────────────────────────────────────────────────────
# ja  · the 2,136 Jōyō kanji (grades 1–8) — the official regular-use set
#     · the top ~1,200 kanji by Aozora corpus frequency (catches common non-Jōyō)
#     · all hiragana, katakana, CJK + full-width punctuation
#
# zh-tw · CLDR's zh_Hant exemplar sets (main + auxiliary + index + numbers),
#         ~2,700 hanzi — the common-use core, so a visitor typing their own text
#         into the generator still gets real glyphs rather than a fallback
#       · Bopomofo (U+3100-312F), CJK + full-width punctuation
#       · EVERY han character actually used in src/content/i18n/zh-tw.json and
#         src/content/ui.json. This is the part that guarantees the site's own
#         copy can never fall back, and it is why the bundle must exist before
#         this script runs. test/cjk-font.test.mjs re-checks that coverage, so
#         editing zh-tw copy without rerunning this script fails CI rather than
#         shipping a system-fallback glyph mid-sentence.
#
# Both sets also carry Latin, digits, currency, arrows and the design's glyph set
# (› ▴ ▾ ✓ ✕ …). Latin is a per-glyph safety net only: the @font-face
# unicode-range in src/styles/tokens/fonts.css lists ONLY that language's ranges,
# so Latin text keeps rendering in Space Grotesk and other locales never fetch
# these files at all.
#
# ── Requirements ───────────────────────────────────────────────────────────
#   python3 -m venv .fontenv && .fontenv/bin/pip install fonttools brotli
# .fontenv/ is gitignored. Noto Sans JP and Noto Sans TC are both OFL, the same
# licence as the other two families here.

set -euo pipefail
cd "$(dirname "$0")/.."

VENV="${VENV:-.fontenv}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
WEIGHTS=(400 500 600 700)   # must match the Space Grotesk weights in fonts.css

WANT="${1:-all}"
case "$WANT" in
  ja|zh-tw|all) ;;
  *) echo "✗ unknown target '$WANT' — use ja, zh-tw or all"; exit 1 ;;
esac

for bin in "$VENV/bin/pyftsubset" "$VENV/bin/python"; do
  [ -x "$bin" ] || { echo "✗ missing $bin — see the Requirements block above"; exit 1; }
done

# subset_family <src-url> <charset-file> <output-prefix> <output-suffix>
subset_family() {
  local src="$1" txtfile="$2" prefix="$3" suffix="$4"
  echo "→ downloading $(basename "$src")…"
  curl -sL -o "$WORK/src.ttf" "$src"
  [ -s "$WORK/src.ttf" ] || { echo "✗ download failed"; exit 1; }
  for wt in "${WEIGHTS[@]}"; do
    echo "→ weight $wt…"
    "$VENV/bin/python" -m fontTools.varLib.instancer "$WORK/src.ttf" "wght=$wt" -o "$WORK/inst.ttf" >/dev/null
    "$VENV/bin/pyftsubset" "$WORK/inst.ttf" \
      --output-file="public/fonts/${prefix}-${wt}-${suffix}.woff2" \
      --flavor=woff2 --text-file="$txtfile" \
      --layout-features='kern,liga,palt,vert,locl' --no-hinting --desubroutinize
  done
}

# Shared tail: Latin, punctuation, currency, arrows, box drawing, design glyphs.
COMMON_RANGES="(0x3000,0x303F),(0xFF00,0xFFEF),(0x0020,0x024F),(0x2010,0x205E),(0x20A0,0x20BF),(0x2190,0x21FF),(0x2500,0x25FF)"
COMMON_GLYPHS='›▴▾✓✕↓♥⚠⏎×☕—–…「」『』【】〜・'

if [ "$WANT" = "ja" ] || [ "$WANT" = "all" ]; then
  echo "── ja ──────────────────────────────────────────"
  echo "→ building character set…"
  curl -sL -o "$WORK/kanji.json" https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json
  curl -sL -o "$WORK/freq.json"  https://raw.githubusercontent.com/scriptin/topokanji/master/data/kanji-frequency/aozora.json
  "$VENV/bin/python" - "$WORK" "$COMMON_RANGES" "$COMMON_GLYPHS" <<'PY'
import json,sys
w,ranges,glyphs=sys.argv[1],sys.argv[2],sys.argv[3]
kanji=json.load(open(f'{w}/kanji.json',encoding='utf-8'))
joyo=[k for k,v in kanji.items() if isinstance(v.get('grade'),int) and 1<=v['grade']<=8]
assert len(joyo)==2136, f'expected 2136 Joyo kanji, got {len(joyo)} — source data changed'
freq=json.load(open(f'{w}/freq.json',encoding='utf-8'))
chars=set(joyo)|{r[0] for r in freq[1:1201] if len(r[0])==1}
for a,b in [(0x3040,0x309F),(0x30A0,0x30FF),(0x31F0,0x31FF)]+eval(f'[{ranges}]'):
    chars|={chr(c) for c in range(a,b+1)}
chars|=set(glyphs)
open(f'{w}/ja.txt','w',encoding='utf-8').write(''.join(sorted(chars)))
print(f'  {len(chars)} codepoints ({len(joyo)} Jōyō)')
PY
  subset_family \
    "https://github.com/notofonts/noto-cjk/raw/main/Sans/Variable/TTF/Subset/NotoSansJP-VF.ttf" \
    "$WORK/ja.txt" "noto-sans-jp" "japanese"
fi

if [ "$WANT" = "zh-tw" ] || [ "$WANT" = "all" ]; then
  echo "── zh-tw ───────────────────────────────────────"
  echo "→ building character set…"
  curl -sL -o "$WORK/zh_Hant.xml" https://raw.githubusercontent.com/unicode-org/cldr/main/common/main/zh_Hant.xml
  "$VENV/bin/python" - "$WORK" "$COMMON_RANGES" "$COMMON_GLYPHS" <<'PY'
import json,sys,xml.etree.ElementTree as ET
w,ranges,glyphs=sys.argv[1],sys.argv[2],sys.argv[3]
root=ET.parse(f'{w}/zh_Hant.xml').getroot()
def is_han(c): return '一'<=c<='鿿' or '㐀'<=c<='䶿'
cldr=set()
for e in root.iter('exemplarCharacters'):
    if (e.get('type') or 'main') in ('main','auxiliary','index','numbers'):
        cldr|={c for c in (e.text or '') if is_han(c)}
assert len(cldr)>2000, f'CLDR zh_Hant gave only {len(cldr)} hanzi — source data changed'

# Every han character the shipped copy actually uses. Without this a rare
# character in one FAQ answer renders in a system fallback mid-sentence.
content=set()
def walk(o):
    if isinstance(o,str): content.update(o)
    elif isinstance(o,list):
        for v in o: walk(v)
    elif isinstance(o,dict):
        for v in o.values(): walk(v)
for p in ('src/content/i18n/zh-tw.json','src/content/ui.json'):
    walk(json.load(open(p,encoding='utf-8')))
content={c for c in content if is_han(c)}
missing=content-cldr

chars=cldr|content
for a,b in [(0x3100,0x312F),(0x31C0,0x31EF),(0x2E80,0x2EFF)]+eval(f'[{ranges}]'):
    chars|={chr(c) for c in range(a,b+1)}
chars|=set(glyphs)
open(f'{w}/zh.txt','w',encoding='utf-8').write(''.join(sorted(chars)))
print(f'  {len(chars)} codepoints ({len(cldr)} CLDR hanzi, {len(content)} used by our copy, {len(missing)} of those outside CLDR)')
PY
  subset_family \
    "https://github.com/notofonts/noto-cjk/raw/main/Sans/Variable/TTF/Subset/NotoSansTC-VF.ttf" \
    "$WORK/zh.txt" "noto-sans-tc" "zh-hant"

  # Coverage manifest, read back out of the FONT rather than from the intended
  # character list — so it records what actually shipped, not what we meant to
  # ship. test/cjk-font.test.mjs compares the zh-tw copy against this.
  echo "→ writing coverage manifest…"
  "$VENV/bin/python" - <<'PY'
import json
from fontTools.ttLib import TTFont
cmap=TTFont('public/fonts/noto-sans-tc-400-zh-hant.woff2').getBestCmap()
han=sorted(chr(c) for c in cmap if 0x4E00<=c<=0x9FFF or 0x3400<=c<=0x4DBF)
json.dump({'_comment':'Han characters present in the committed noto-sans-tc woff2 files. Generated by scripts/build-cjk-subset.sh; read by test/cjk-font.test.mjs. Do not hand-edit.','han':han},
          open('public/fonts/noto-sans-tc.coverage.json','w',encoding='utf-8'),ensure_ascii=False)
print(f'  {len(han)} han glyphs recorded')
PY
fi

echo
ls -l public/fonts/noto-sans-*.woff2 | awk '{printf "  %-42s %5.0f KB\n",$9,$5/1024}'
echo "✓ done — commit the .woff2 files. check-build.mjs asserts they are served."

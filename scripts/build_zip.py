"""パソコン用の配布ZIP（dist/YouTubeCommentSakiyomi.zip）を作る。

GitHub Actions から自動で呼ばれます。手元で試すときは:
    python scripts/build_zip.py
"""
import json
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
FOLDER = "YouTubeCommentSakiyomi"  # 展開したときのフォルダ名
FILES = ["manifest.json", "content.js", "filter.js", "content.css", "使い方.txt"]


def main() -> int:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]

    # manifest.json に書かれたファイルが全部そろっているか確認
    needed = set(FILES)
    for cs in manifest.get("content_scripts", []):
        needed.update(cs.get("js", []))
        needed.update(cs.get("css", []))
    missing = [f for f in sorted(needed) if not (ROOT / f).is_file()]
    if missing:
        print("見つからないファイル:", ", ".join(missing))
        return 1
    extra = sorted(needed - set(FILES))
    if extra:
        print("FILES に入っていないファイルが manifest.json にあります:", ", ".join(extra))
        return 1

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / f"{FOLDER}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in FILES:
            # Windows で開きやすいよう改行を CRLF にそろえる（使い方.txt をメモ帳で読むため）
            data = (ROOT / f).read_bytes()
            if f.endswith(".txt"):
                data = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            z.writestr(f"{FOLDER}/{f}", data)
    print(f"作成: {out}（バージョン {version}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

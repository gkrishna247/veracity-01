"""Generate curated test data for Veracity AI dashboard.

Creates test samples for all 4 prediction input types:
  1. GossipCop text-only  (20 rows: 10 real + 10 fake)
  2. Weibo text-only      (20 rows: 10 real + 10 fake)
  3. Weibo image-only     (10 images: 5 real + 5 fake)
  4. Weibo text+image     (20 samples: 10 real + 10 fake with data.csv)

Images are copied from the source input/images/ directory.
Labels (real/fake splits) are based on ORIGINAL dataset labels, NOT predictions.
"""

import os
import shutil
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.dirname(BASE_DIR)  # results/
GC_CSV = os.path.join(SOURCE_DIR, "input", "datasets", "gossipcop_final.csv")
WB_CSV = os.path.join(SOURCE_DIR, "input", "datasets", "weibo_final.csv")
IMAGES_DIR = os.path.join(SOURCE_DIR, "input", "images")
TEST_DIR = os.path.join(BASE_DIR, "test_data")

SEED = 42


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _image_exists(filename: str) -> bool:
    """Check if the image file exists in the source images directory."""
    return os.path.isfile(os.path.join(IMAGES_DIR, filename))


def generate_gossipcop_text_only() -> None:
    """Generate 20-row balanced GossipCop sample (10 real + 10 fake)."""
    print("[1/4] Generating GossipCop text-only test data...")
    gc = pd.read_csv(GC_CSV)
    real = gc[gc["label"] == "real"].sample(n=10, random_state=SEED)
    fake = gc[gc["label"] == "fake"].sample(n=10, random_state=SEED)
    sample = pd.concat([real, fake]).sample(frac=1, random_state=SEED).reset_index(drop=True)

    out_dir = os.path.join(TEST_DIR, "gossipcop_text_only")
    _ensure_dir(out_dir)
    sample.to_csv(os.path.join(out_dir, "sample.csv"), index=False, encoding="utf-8")
    print(f"   ✓ Saved {len(sample)} rows → gossipcop_text_only/sample.csv")


def generate_weibo_text_only() -> None:
    """Generate 20-row balanced Weibo sample (10 real + 10 fake), text only."""
    print("[2/4] Generating Weibo text-only test data...")
    wb = pd.read_csv(WB_CSV)
    real = wb[wb["label"] == 0].sample(n=10, random_state=SEED)
    fake = wb[wb["label"] == 1].sample(n=10, random_state=SEED)
    sample = pd.concat([real, fake]).sample(frac=1, random_state=SEED).reset_index(drop=True)

    out_dir = os.path.join(TEST_DIR, "weibo_text_only")
    _ensure_dir(out_dir)
    sample[["tweet_id", "tweet_content", "label"]].to_csv(
        os.path.join(out_dir, "sample.csv"), index=False, encoding="utf-8"
    )
    print(f"   ✓ Saved {len(sample)} rows → weibo_text_only/sample.csv")


def generate_weibo_image_only() -> None:
    """Copy 5 real + 5 fake images based on original dataset labels."""
    print("[3/4] Generating Weibo image-only test data...")
    wb = pd.read_csv(WB_CSV)

    for label_val, label_name in [(0, "real"), (1, "fake")]:
        subset = wb[wb["label"] == label_val].copy()
        subset = subset[subset["image_files"].notna() & (subset["image_files"] != "")]
        out_dir = os.path.join(TEST_DIR, "weibo_image_only", label_name)
        _ensure_dir(out_dir)

        copied = 0
        for _, row in subset.sample(frac=1, random_state=SEED).iterrows():
            if copied >= 5:
                break
            img_name = str(row["image_files"]).split("|")[0].strip()
            if _image_exists(img_name):
                src = os.path.join(IMAGES_DIR, img_name)
                dst = os.path.join(out_dir, img_name)
                shutil.copy2(src, dst)
                copied += 1

        print(f"   ✓ Copied {copied} {label_name} images → weibo_image_only/{label_name}/")


def generate_weibo_text_image() -> None:
    """Generate 10 real + 10 fake text+image pairs with data.csv files."""
    print("[4/4] Generating Weibo text+image test data...")
    wb = pd.read_csv(WB_CSV)

    for label_val, label_name in [(0, "real"), (1, "fake")]:
        subset = wb[wb["label"] == label_val].copy()
        subset = subset[
            subset["image_files"].notna()
            & (subset["image_files"] != "")
            & subset["tweet_content"].notna()
            & (subset["tweet_content"].str.strip() != "")
        ]
        out_dir = os.path.join(TEST_DIR, "weibo_text_image", label_name)
        _ensure_dir(out_dir)

        rows = []
        for _, row in subset.sample(frac=1, random_state=SEED + label_val).iterrows():
            if len(rows) >= 10:
                break
            img_name = str(row["image_files"]).split("|")[0].strip()
            if _image_exists(img_name):
                src = os.path.join(IMAGES_DIR, img_name)
                dst = os.path.join(out_dir, img_name)
                shutil.copy2(src, dst)
                rows.append({
                    "text": str(row["tweet_content"]).strip(),
                    "image_filename": img_name,
                })

        data_csv = pd.DataFrame(rows)
        data_csv.to_csv(os.path.join(out_dir, "data.csv"), index=False, encoding="utf-8")
        print(f"   ✓ Saved {len(rows)} {label_name} pairs → weibo_text_image/{label_name}/")


def main() -> None:
    print("=" * 60)
    print("Veracity AI — Test Data Generator")
    print("=" * 60)
    generate_gossipcop_text_only()
    generate_weibo_text_only()
    generate_weibo_image_only()
    generate_weibo_text_image()
    print("=" * 60)
    print("All test data generated successfully.")


if __name__ == "__main__":
    main()

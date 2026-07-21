import csv
import os
from barcode import Code128
from barcode.writer import ImageWriter

CSV_FILE = "product-fix.csv"
OUTPUT_DIR = "barcode/image"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(CSV_FILE, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        barcode = row["barcode"].strip()
        nama = row["nama"].strip()
        if not barcode:
            continue
        safe_name = "".join(c for c in barcode if c.isalnum() or c in "._- ")
        filename = os.path.join(OUTPUT_DIR, f"{safe_name}.png")
        if os.path.exists(filename):
            print(f"SKIP (exists): {barcode}")
            continue
        try:
            Code128(barcode, writer=ImageWriter()).save(
                os.path.join(OUTPUT_DIR, safe_name)
            )
            print(f"OK: {barcode} -> {filename}")
        except Exception as e:
            print(f"ERROR: {barcode} - {e}")

print("Selesai.")

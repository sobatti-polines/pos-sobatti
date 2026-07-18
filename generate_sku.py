import csv
import re

INPUT_CSV = "DAFTAR BARANG PLK.csv"
OUTPUT_CSV = "DAFTAR BARANG PLK - WITH SKU.csv"

colors = {
    "PUTIH", "HITAM", "KUNING", "BIRU", "MERAH", "HIJAU", "ORANGE",
    "BENING", "SILVER", "BLACK", "WHITE", "GRAY", "GREY", "MAROON",
    "PINK", "COKELAT", "ABU", "UNGU", "TRANSPARAN",
}

materials = {
    "PVC", "BESI", "KUNINGAN", "STAINLESS", "ALUMINIUM", "GALVANIS",
    "KARET", "BAJA", "GG", "NYLON", "KAYU", "FIBER", "KACA",
    "BULAT", "PLAT", "SOLAR", "TEMBOK", "TANAM",
}

sizes = {
    "BESAR", "KECIL", "PANJANG", "PENDEK", "TEBAL", "TIPIS",
    "LURUS", "BENGKOK", "BUKA", "TUTUP", "BULAT", "LANCIP",
    "PAPAK", "OVAL", "GEPENG",
}

known_brands = [
    "HIOSHI", "MODERN", "HASSTON", "GRT", "HPP", "RRT", "WANLY",
    "CAMEL", "FUKUDA", "TEKIRO", "GOMEO", "BOSCH", "ETERNA", "ONDA",
    "IGM", "ISCO", "JOPEX", "SOLIGEN", "MULLER", "HUBEN", "KENMASTER",
    "XENON", "LAZARO", "SUNRISE", "MASPION", "MIYAKO", "COSMOS",
    "RINNAI", "TOP", "KEEP", "VERRIZ", "NISHIO", "GLX", "GDO", "FRT",
    "CAB", "MDN", "KZK", "SAB", "TORA", "FURANO", "OMCO", "REYNER",
    "BRANCH", "IKURA", "BLITZ", "MOLLAR", "BISON", "VIPER", "POPEYE",
    "ARMADA", "STARCAM", "CAISAR", "DOZIRO", "KODENKI", "ANDO", "JEJE",
    "MST", "MAXTECH", "GLADIO", "TAIYO", "INAX", "YY", "KINIK",
    "BULL", "NIKKO", "BLACKFOOT", "FREED", "STALION", "MJP", "LAKONI",
    "BOLZANO", "MAJESTY", "NEWSTAR", "ELFA", "JUWANA", "CHIYO", "AOSTA",
    "OLIQ", "HANJIN", "IWA", "MEIJER", "SCHLIEPER", "GNT", "FISCHER",
    "KODAI", "BOSTON", "MALVIN", "EASTGUARD", "HSJ", "ESSEN", "ORCHAD",
    "NETZ", "ONAT", "AMANI", "IDEKU", "DEXTONE", "HI-Q", "NIPPONPLAS",
    "MUGEN", "KYOKO", "CEDAR", "SBS", "ISP", "EAGLE", "NRT", "WINGAS",
    "MERCY", "ARTCO", "VOXY", "CTJ", "UNO", "EIFFEL", "CML", "SIP",
    "WD", "BEST", "BESTGUARD", "AXL", "DOLPHIN", "KENCANA",
    "UCP", "KURA", "ZP", "FREDER", "OBAT", "H", "KINCO",
    "JF", "JP", "WP", "GP", "SN", "SC", "AC", "TC", "UD", "EC",
    "FS", "PL", "YUSTAR", "ABUS", "FNR",
    "KEEGAN", "ROYAL", "SB", "MADICO", "LOSPEN", "KINCIR",
    "ARNETTA", "KARUNIA",
    "MAKITA", "BISON", "STAR", "CLASSIC", "SIGNATURE",
    "DG", "DB", "L", "T", "A", "B", "C", "Y", "V",
]

known_brands_set = {b.upper() for b in known_brands}

category_words = {
    "AMPLAS", "BAUT", "MESIN", "KUNCI", "TANG", "GUNTING", "KABEL",
    "KRAN", "LEM", "PAKU", "SKRUP", "RING", "BAN", "BATU", "RODA",
    "TALI", "PENSIL", "SELANG", "FILTER", "PALU", "GEMBOK", "ENGSEL",
    "GRENDEL", "SIKU", "KUAS", "REL", "TARIKAN", "SARINGAN", "SEPATU",
    "KACAMATA", "HELM", "SARUNG", "KAPSTOK", "KANEBO", "GEROBAK",
    "METERAN", "MEJA", "PELAMPUNG", "POMPA", "REGULATOR", "KOMPOR",
    "KIPAS", "STANG", "RAK", "OBENG", "CETOK", "BODI", "SILINDER",
    "SKRAP", "SPRING", "SPRINGKEL", "STAPLES", "SOLDER", "SEMPROTAN",
    "SEAL", "SIFON", "SHOWER", "TOOL", "TOPENG", "TREKER", "TROWEL",
    "WATERPASS", "WASBAK", "OVERVAK", "HAND", "FLAME", "FEELER",
    "DUDUKAN", "DOOR", "BLENDER", "BETEL", "BAK", "BODEM", "HAK",
    "CUTTING", "KOM", "ISI", "MARKING", "KIKIR", "KLEM", "KOP",
    "LAKER", "PEMANTIK", "PENGUKUR", "REFILL", "ROMPI", "TIMBANGAN",
    "TIP", "WOOL", "TATAH", "TATAKAN", "MATA", "LAKER",
    "TEMBAKAN", "RIVET", "PLANER", "CIRCLE", "JIGSAW", "CHAINKAW",
    "SCROLL", "PROFIL", "PASAH", "POLES", "CORDLESS", "TANCAP",
    "BOLAK", "BALIK", "CEPUK", "KETOK", "TEMBUS", "KOPLING",
    "BAGO", "PAS", "SOK", "RODA", "PALANG", "BANGJO", "OTO",
    "RACHET",
}

stopwords = colors | materials | sizes | category_words | {
    "DENGAN", "DAN", "ATAU", "YANG", "DI", "KE", "SET", "NO",
    "MODEL", "TYPE", "TIPE", "BARU", "BARIS",
}

category_rules = [
    ("BALL VALVE", "Ball Valve"),
    ("CHECK VALVE", "Check Valve"),
    ("FOOT KLEP", "Foot Klep"),
    ("HAND SHOWER", "Hand Shower"),
    ("JET SHOWER", "Jet Shower"),
    ("STOP KRAN", "Stop Kran"),
    ("DIAMOND HOLE SAW", "Diamond Hole Saw"),
    ("DIAMOND WHEEL", "Diamond Wheel"),
    ("HOLE SAW", "Hole Saw"),
    ("HOLESAW", "Hole Saw"),
    ("FLAP DISC", "Flap Disc"),
    ("MAGIC COM", "Magic Com"),
    ("QUICK COUPLER", "Quick Coupler"),
    ("AMPLAS", "Amplas"),
    ("ANGKER", "Angker"),
    ("BAUT", "Baut"),
    ("BODI", "Bodi"),
    ("DYNABOLT", "Dynabolt"),
    ("ENGSEL", "Engsel"),
    ("GEMBOK", "Gembok"),
    ("GERGAJI", "Gergaji"),
    ("GRENDEL", "Grendel"),
    ("GUNTING", "Gunting"),
    ("KABEL", "Kabel"),
    ("KIPAS", "Kipas Angin"),
    ("KOMPOR", "Kompor"),
    ("KRAN", "Kran"),
    ("KUAS", "Kuas"),
    ("KUNCI", "Kunci"),
    ("LEM", "Lem"),
    ("MATA", "Mata"),
    ("MESIN", "Mesin"),
    ("OBENG", "Obeng"),
    ("PAKU", "Paku"),
    ("PALU", "Palu"),
    ("PELAMPUNG", "Pelampung"),
    ("POMPA", "Pompa"),
    ("REGULATOR", "Regulator"),
    ("REL", "Rel"),
    ("RODA", "Roda"),
    ("ROL METER", "Rol Meter"),
    ("ROLL METER", "Roll Meter"),
    ("SAKLAR", "Saklar"),
    ("SARINGAN", "Saringan"),
    ("SELANG", "Selang"),
    ("SEPATU", "Sepatu"),
    ("SETRIKA", "Setrika"),
    ("SIKU", "Siku"),
    ("SILINDER", "Silinder"),
    ("SKRAP", "Skrap"),
    ("SKRUP", "Skrup"),
    ("STANG", "Stang"),
    ("TALI", "Tali"),
    ("TANG", "Tang"),
    ("TARIKAN", "Tarikan"),
    ("TATAH", "Tatah"),
    ("TATAKAN", "Tatakan"),
    ("TIMBANGAN", "Timbangan"),
    ("WATERPASS", "Waterpass"),
    ("WASBAK", "Wasbak"),
    ("KAPASITOR", "Kapasitor"),
    ("HELM", "Helm"),
    ("KACAMATA", "Kacamata"),
    ("SARUNG", "Sarung Tangan"),
    ("BAN", "Ban"),
    ("BATU", "Batu"),
    ("BULU", "Bulu Kuas"),
    ("CETOK", "Cetok"),
    ("FILTER", "Filter"),
    ("FISCHER", "Fischer"),
    ("GEROBAK", "Gerobak"),
    ("ISI", "Isi"),
    ("KANEBO", "Kanebo"),
    ("KAPSTOK", "Kapstok"),
    ("KAWAT", "Kawat Las"),
    ("KEPALA", "Kepala"),
    ("KIKIR", "Kikir"),
    ("KLEM", "Klem"),
    ("KOP", "Kop Kaca"),
    ("LAKER", "Laker"),
    ("MARKING", "Marking"),
    ("MEJA", "Meja"),
    ("METERAN", "Meteran"),
    ("OVERVAL", "Overval"),
    ("PEMANTIK", "Pemantik"),
    ("PENGUKUR", "Pengukur"),
    ("PENSIL", "Pensil"),
    ("RAK", "Rak"),
    ("RANTAI", "Rantai"),
    ("REFILL", "Refill"),
    ("RING", "Ring"),
    ("ROMPI", "Rompi"),
    ("TIMBANGAN", "Timbangan"),
    ("TIP", "Tip On"),
    ("TOOL", "Tool Box"),
    ("TOPENG", "Topeng"),
    ("TREKER", "Treker"),
    ("TROWEL", "Trowel"),
    ("WOOL", "Wool Wheel"),
    ("SPRING", "Spring"),
    ("SPRINGKEL", "Springkel"),
    ("STAPLES", "Staples"),
    ("SPRAY", "Spray Gun"),
    ("SOLDER", "Solder"),
    ("SEMPROTAN", "Semprotan"),
    ("SEAL", "Seal"),
    ("SIFON", "Sifon"),
    ("SHOWER", "Shower"),
    ("CONNECTOR", "Connector"),
    ("FLAME", "Flame Gun"),
    ("FEELER", "Feeler Gauge"),
    ("DUDUKAN", "Dudukan"),
    ("DOOR", "Door Closer"),
    ("CB", "CB"),
    ("BODY", "Body Harness"),
    ("BLENDER", "Blender"),
    ("BETEL", "Betel"),
    ("AS", "As Grobak"),
    ("BAK", "Bak Gerobak"),
    ("HOT", "Hot Plate"),
    ("TIRE", "Tire Inflator"),
    ("BODEM", "Bodem"),
    ("HAK", "Hak Angin"),
    ("CUTTING", "Cutting"),
    ("GRENDEL", "Grendel"),
    ("KOM", ""),
]


def extract_category(name):
    name_upper = name.upper().strip()
    for pattern, cat in category_rules:
        if name_upper.startswith(pattern):
            return cat
    first_word = name_upper.split()[0] if name_upper.split() else ""
    return first_word.capitalize() if first_word else "Lainnya"


def clean_spec_tokens(tokens):
    result = []
    for t in tokens:
        t_clean = t.strip('"\'()[],.')
        if not t_clean:
            continue
        if re.match(r'^\d+(\.\d+)?(MM|CM|M|KG|LB|OZ|"|\'\')?$', t_clean, re.IGNORECASE):
            continue
        if re.match(r'^M\d+X\d+$', t_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d+(\.\d+)?X\d+(\.\d+)?$', t_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d+-\d+$', t_clean):
            continue
        if re.match(r'^[A-Z]-\d+$', t_clean):
            continue
        if re.match(r'^[A-Z]{2,3}\d+$', t_clean):
            continue
        if re.match(r'^\d+(MM|CM|M|")$', t_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d{5,}$', t_clean):
            continue
        if re.match(r'^\d+[A-Z]\d+$', t_clean):
            continue
        if re.match(r'^M-\d+[A-Z]?$', t_clean):
            continue
        if re.match(r'^[A-Z]{1,2}\d{2,4}$', t_clean):
            continue
        result.append(t_clean)
    return result


def extract_brand(name):
    tokens = name.upper().split()
    cleaned = clean_spec_tokens(tokens)

    ambiguous_brands = {"BEST", "TOP", "GP", "SN", "AC", "PRO", "STAR", "CLASSIC", "MINI", "SUPRA", "GOOD"}
    known_found = [t for t in cleaned if t in known_brands_set]
    if known_found:
        non_ambig = [t for t in known_found if t not in ambiguous_brands]
        if non_ambig:
            candidate = non_ambig[-1]
        else:
            candidate = known_found[-1]
        if candidate not in colors and candidate not in materials and candidate not in sizes:
            return candidate

    for t in reversed(cleaned):
        if t not in stopwords and len(t) >= 2 and not re.match(r'^\d+', t):
            return t

    return "GENERIC"


def brand_code(brand_name):
    if len(brand_name) >= 4:
        return brand_name[:4]
    return brand_name


def main():
    rows = []
    with open(INPUT_CSV, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if not row or len(row) < 2:
                continue
            name = (row[1] or "").strip()
            if not name:
                continue
            rows.append(row)

    print(f"Total produk: {len(rows)}")

    brand_counters = {}
    output_rows = [["SKU", "DAFTAR BARANG", "KATEGORI", "MERK"]]
    stats = {"with_known_brand": 0, "without_brand": 0}
    conflict_map = {}
    skipped = []

    for row in rows:
        name = (row[1] or "").strip()

        category = extract_category(name)
        brand = extract_brand(name)

        if brand in known_brands_set:
            stats["with_known_brand"] += 1
        else:
            stats["without_brand"] += 1

        bcode = brand_code(brand)

        if bcode in conflict_map and conflict_map[bcode] != brand:
            alt_code = brand_code(brand + "X")
            while alt_code in conflict_map:
                alt_code = alt_code[:-1] + chr(ord(alt_code[-1]) + 1)
            bcode = alt_code
            skipped.append((name, brand, bcode))

        conflict_map[bcode] = brand
        brand_counters[bcode] = brand_counters.get(bcode, 0) + 1
        seq = brand_counters[bcode]

        sku = f"M{bcode}{seq:04d}"
        output_rows.append([sku, name, category, brand])

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(output_rows)

    print(f"Output: {OUTPUT_CSV}")
    print(f"Produk dengan known brand: {stats['with_known_brand']}")
    print(f"Produk tanpa known brand:  {stats['without_brand']}")
    print(f"Total brand unik:          {len(brand_counters)}")

    if skipped:
        print(f"\n⚠ Konflik brand code di-resolve:")
        for name, brand, bcode in skipped:
            print(f"  {brand} -> {bcode} ({name[:50]})")

    brand_list = sorted(brand_counters.items(), key=lambda x: -x[1])
    print("\nTop 25 brand codes (terbanyak produk):")
    for code, count in brand_list[:25]:
        brand_name = conflict_map[code]
        print(f"  M{code}{'...':<4} ({count:>3} produk) - {brand_name}")

    print("\nContoh 10 SKU pertama:")
    for r in output_rows[1:11]:
        print(f"  {r[0]} | {r[3]:<15} | {r[1][:50]}")


if __name__ == "__main__":
    main()

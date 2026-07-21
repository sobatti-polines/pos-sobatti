import pandas as pd

df = pd.read_csv('product-fix.csv')

# Counter for each brand
brand_counts = {}

def generate_barcode(merk):
    # Handle NaN or missing merk
    if pd.isna(merk) or str(merk).strip() == '':
        brand_str = "XXX"
    else:
        # First 3 letters, uppercase, remove spaces/special chars if any
        clean_merk = "".join(filter(str.isalpha, str(merk).upper()))
        brand_str = clean_merk[:3].ljust(3, 'X')
        
    if brand_str not in brand_counts:
        brand_counts[brand_str] = 1
    else:
        brand_counts[brand_str] += 1
        
    num = str(brand_counts[brand_str]).zfill(2)
    return f"M{brand_str}{num}"

# Update barcode column
df['barcode'] = df['merk'].apply(generate_barcode)
# User might also want kd_brg updated if they want it perfectly neat for the SKU display
df['kd_brg'] = df['barcode']

df.to_csv('product-fix.csv', index=False)
print("Barcodes updated successfully!")

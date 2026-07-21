import os
import io
import pandas as pd
from PIL import Image, ImageDraw, ImageFont, ImageOps
from barcode import Code128
from barcode.writer import ImageWriter

def format_rupiah(value):
    try:
        val = int(float(value))
        return f"{val:,}".replace(",", ".")
    except:
        return "0"

def generate_tags():
    out_dir = "picetag/image"
    os.makedirs(out_dir, exist_ok=True)
    
    df = pd.read_csv("product-fix.csv")
    
    font_bold_path = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
    font_regular_path = "/usr/share/fonts/TTF/DejaVuSans.ttf"
    
    try:
        font_title = ImageFont.truetype(font_bold_path, 34)
        font_sku = ImageFont.truetype(font_regular_path, 20)
        font_rp = ImageFont.truetype(font_bold_path, 42)
    except IOError:
        font_title = ImageFont.load_default()
        font_sku = ImageFont.load_default()
        font_rp = ImageFont.load_default()

    # Preload & setup footer logo
    try:
        logo = Image.open("public/logo-perusahaan.png").convert("RGBA")
        target_w = 600
        target_h = 80
        img_ratio = logo.width / logo.height
        target_ratio = target_w / target_h

        if target_ratio > img_ratio:
            resize_w = target_w
            resize_h = int(target_w / img_ratio)
        else:
            resize_h = target_h
            resize_w = int(target_h * img_ratio)

        logo = logo.resize((resize_w, resize_h), Image.Resampling.LANCZOS)
        left = (logo.width - target_w) / 2
        top = (logo.height - target_h) / 2
        right = (logo.width + target_w) / 2
        bottom = (logo.height + target_h) / 2
        logo = logo.crop((left, top, right, bottom))
    except Exception as e:
        print(f"Peringatan: Gagal load logo. {e}")
        logo = None

    for index, row in df.iterrows():
        sku = str(row['kd_brg'])
        nama = str(row['nama'])
        harga = str(row['modal']) 
        
        img = Image.new('RGB', (600, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        # 1. Header
        nama_display = (nama[:35] + '..') if len(nama) > 35 else nama
        draw.text((25, 20), nama_display.upper(), font=font_title, fill='black')
        draw.text((25, 62), sku.upper(), font=font_sku, fill='black')
        
        # Garis batas 1
        draw.line((0, 95, 600, 95), fill='black', width=3)
        
        # 2. Harga
        harga_format = format_rupiah(harga)
        
        # Cari font size price yang pas agar tidak numpuk dengan Rp
        font_price_size = 110
        try:
            font_price = ImageFont.truetype(font_bold_path, font_price_size)
            rp_bbox = draw.textbbox((0, 0), "Rp", font=font_rp)
            rp_w = rp_bbox[2] - rp_bbox[0]
            
            while True:
                price_bbox = draw.textbbox((0, 0), harga_format, font=font_price)
                price_w = price_bbox[2] - price_bbox[0]
                # Check jika tidak numpuk (x_price > x_rp + padding)
                if (575 - price_w) > (25 + rp_w + 10) or font_price_size <= 40:
                    break
                font_price_size -= 5
                font_price = ImageFont.truetype(font_bold_path, font_price_size)
        except IOError:
            font_price = ImageFont.load_default()
            price_w = draw.textbbox((0, 0), harga_format, font=font_price)[2]

        baseline_y = 185
        if getattr(font_rp, 'getmetrics', None):
            rp_y = baseline_y - font_rp.getmetrics()[0]
            price_y = baseline_y - font_price.getmetrics()[0]
        else:
            rp_y = 120
            price_y = 90
            
        draw.text((25, rp_y), "Rp", font=font_rp, fill='#ff0000')
        draw.text((575 - price_w, price_y), harga_format, font=font_price, fill='#ff0000')
        
        # Garis batas 2
        draw.line((0, 205, 600, 205), fill='black', width=3)
        
        # 3. Barcode
        try:
            rv = io.BytesIO()
            Code128(sku, writer=ImageWriter()).write(rv, options={
                'module_width': 0.35,
                'module_height': 7,
                'font_size': 9,
                'text_distance': 4,
                'quiet_zone': 0.5,
                'background': 'white',
                'dpi': 300
            })
            rv.seek(0)
            barcode_img = Image.open(rv).convert("RGBA")
            
            if barcode_img.height > 105:
                scale = 105 / barcode_img.height
                barcode_img = barcode_img.resize((int(barcode_img.width * scale), 105), Image.Resampling.LANCZOS)
                
            x_pos = (600 - barcode_img.width) // 2
            y_pos = 210 + (110 - barcode_img.height) // 2
            img.paste(barcode_img, (x_pos, y_pos), barcode_img)
        except Exception as e:
            pass # Skip barcode on err
        
        # 4. Footer Logo
        draw.rectangle((0, 320, 600, 400), fill='black')
        if logo:
            img.paste(logo, (0, 320), logo)
        
        # Save
        safe_sku = "".join([c for c in sku if c.isalnum() or c in ['-', '_']]).strip()
        if not safe_sku: safe_sku = f"unknown_{index}"
        out_path = os.path.join(out_dir, f"{safe_sku}.png")
        img.save(out_path)

if __name__ == "__main__":
    generate_tags()

import io
from PIL import Image, ImageDraw, ImageFont, ImageOps
from barcode import Code128
from barcode.writer import ImageWriter

img = Image.new('RGB', (600, 400), color='white')
draw = ImageDraw.Draw(img)

font_bold_path = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
font_regular_path = "/usr/share/fonts/TTF/DejaVuSans.ttf"
font_title = ImageFont.truetype(font_bold_path, 34)
font_sku = ImageFont.truetype(font_regular_path, 20)
font_rp = ImageFont.truetype(font_bold_path, 42)

# 1. Header
nama_display = "AMPLAS BULAT 120 SAB"
sku = "AMP BLT 120"
draw.text((25, 20), nama_display, font=font_title, fill='black')
draw.text((25, 62), sku, font=font_sku, fill='black')

# Sep 1
draw.line((0, 95, 600, 95), fill='black', width=3)

# 2. Price
harga_format = "3.200.000"

# Find a suitable font size for price so it doesn't overlap Rp
font_price_size = 110
font_price = ImageFont.truetype(font_bold_path, font_price_size)
rp_bbox = draw.textbbox((0, 0), "Rp", font=font_rp)
rp_w = rp_bbox[2] - rp_bbox[0]

while True:
    price_bbox = draw.textbbox((0, 0), harga_format, font=font_price)
    price_w = price_bbox[2] - price_bbox[0]
    if (575 - price_w) > (25 + rp_w + 10) or font_price_size <= 40:
        break
    font_price_size -= 5
    font_price = ImageFont.truetype(font_bold_path, font_price_size)

baseline_y = 185
draw.text((25, baseline_y - font_rp.getmetrics()[0]), "Rp", font=font_rp, fill='#ff0000')
draw.text((575 - price_w, baseline_y - font_price.getmetrics()[0]), harga_format, font=font_price, fill='#ff0000')

# Sep 2
draw.line((0, 205, 600, 205), fill='black', width=3)

# 3. Barcode
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

# 4. Footer Logo
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

img.paste(logo, (0, 320), logo)

img.save("test_out2.png")
print("Done test_out2.png")

import os
import re

base_dir = '/home/haydar/Code/POS/app'
directories_to_scan = ['app', 'components', 'lib']

# Collect all files
files_data = []
for d in directories_to_scan:
    dir_path = os.path.join(base_dir, d)
    if not os.path.isdir(dir_path):
        continue
    for root, dirs, files in os.walk(dir_path):
        if 'node_modules' in root or '.next' in root or '.git' in root or '.venv' in root:
            continue
        for f in files:
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                continue
            file_path = os.path.join(root, f)
            rel_path = os.path.relpath(file_path, base_dir)
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    files_data.append({
                        'path': rel_path,
                        'content': content
                    })
            except Exception:
                pass

# Extract forms and their tables
form_inputs = {} # table -> list of forms
table_displays = {} # table -> list of pages

def extract_tables(content, mode):
    tables = []
    if mode == 'insert_update':
        tables = re.findall(r'\.from\([\'"]([a-zA-Z0-9_]+)[\'"]\)\.(?:insert|update)', content)
    elif mode == 'select':
        tables = re.findall(r'\.from\([\'"]([a-zA-Z0-9_]+)[\'"]\)\.select', content)
    return list(set(tables))

for file in files_data:
    content = file['content']
    path = file['path']
    
    # Forms / Inputs
    inserted = extract_tables(content, 'insert_update')
    for t in inserted:
        if t not in form_inputs:
            form_inputs[t] = set()
        form_inputs[t].add(path)
        
    # UI Table Displays (Selects)
    selected = extract_tables(content, 'select')
    for t in selected:
        if t not in table_displays:
            table_displays[t] = set()
        table_displays[t].add(path)
        
    # Some form actions might be in API routes
    if path.startswith('app/api') and ('insert' in content or 'update' in content):
        ins_api = re.findall(r'\.from\([\'"]([a-zA-Z0-9_]+)[\'"]\)\.(?:insert|update)', content)
        for t in ins_api:
            if t not in form_inputs:
                form_inputs[t] = set()
            form_inputs[t].add(path)

# Special cases: API routes called by frontend
# e.g. /api/attendance/checkin -> inserts absensi
# e.g. /api/pos/checkout -> inserts transaksi_keluar, detail_transaksi_keluar

report = "# 4. Alur Data Tabel UI dan Sumber Input Form\n\n"
report += "Dokumen ini menjelaskan secara mendetail halaman mana yang menampilkan sebuah tabel data, tabel Supabase apa yang ditampilkan, dan dari mana/halaman mana pengguna menginputkan data tersebut (Form/Action).\n\n"

# Get all unique tables found
all_tables = sorted(list(set(list(table_displays.keys()) + list(form_inputs.keys()))))

for table in all_tables:
    report += f"## Data Tabel: `{table}`\n\n"
    
    # Where is it displayed?
    report += "### Ditampilkan di Halaman (View/Read):\n"
    displays = table_displays.get(table, [])
    if displays:
        for d in sorted(list(displays)):
            report += f"- `{d}`\n"
    else:
        report += "- *(Tidak ditemukan query `.select()` langsung di frontend/kode sumber. Mungkin di-fetch via RPC atau API lain)*\n"
        
    # Where is it inputted?
    report += "\n### Diinputkan dari Halaman/Form (Insert/Update):\n"
    inputs = form_inputs.get(table, [])
    if inputs:
        for i in sorted(list(inputs)):
            # find corresponding UI form if it's an action file
            report += f"- **Aksi/Form di:** `{i}`\n"
            
            # Let's try to trace which page uses this action
            # if i is actions.ts, we find who imports it
            action_name = os.path.basename(i)
            if 'action' in action_name or 'lib' in i:
                users = []
                # simple heuristic: look for import from this path
                base_module = i.replace('.ts', '').replace('.tsx', '').replace('app/', '')
                base_dir_i = os.path.dirname(i)
                for f in files_data:
                    # just check if base_dir_i is in f['path'] or something
                    if f['path'] != i and base_dir_i != '' and base_dir_i in f['path'] and f['path'].endswith('.tsx'):
                        users.append(f['path'])
                if users:
                    report += f"  - *Kemungkinan Form UI berada di:* {', '.join(users)}\n"
    else:
        report += "- *(Tidak ditemukan query `.insert()` atau `.update()` langsung. Mungkin via API atau fitur ini belum selesai)*\n"
        
    report += "\n---\n\n"

# Tambahan khusus: Analisis eksplisit per rute UI untuk memberikan insight ke user
report += "## Analisis Eksplisit Per Halaman Dashboard\n\n"
ui_routes = [
    '/dashboard/customers',
    '/dashboard/inventory',
    '/dashboard/inventory/stock-in',
    '/dashboard/inventory/stock-in/history',
    '/dashboard/inventory/stock-opname',
    '/dashboard/inventory/stock-opname/history',
    '/dashboard/laporan/laba-rugi',
    '/dashboard/laporan/neraca',
    '/dashboard/laporan-kasir',
    '/dashboard/hutang',
    '/dashboard/piutang',
    '/dashboard/transactions',
    '/dashboard/suppliers',
    '/dashboard/settings/users',
    '/dashboard/settings/reference-data',
    '/dashboard/settings/keuangan',
    '/dashboard/attendance/history',
    '/dashboard/attendance/report',
]

for route in ui_routes:
    route_path = f"app{route}/page.tsx"
    client_path = f"app{route}"
    
    report += f"### Halaman: `{route}`\n"
    
    # find any file related to this route
    route_files = [f for f in files_data if route in f['path']]
    
    # what tables are they using?
    used_selects = set()
    used_inserts = set()
    forms = []
    
    for f in route_files:
        content = f['content']
        used_selects.update(extract_tables(content, 'select'))
        used_inserts.update(extract_tables(content, 'insert_update'))
        if 'useForm' in content or '<form' in content:
            forms.append(f['path'])
            
    if used_selects:
        report += f"- **Menampilkan Data dari Tabel:** {', '.join(used_selects)}\n"
    else:
        report += "- **Menampilkan Data:** (Melalui RPC atau tidak ada select langsung)\n"
        
    if forms:
        report += f"- **Form Input/Action di Rute ini:**\n"
        for form in forms:
            report += f"  - `{form}`\n"
        if used_inserts:
             report += f"  - **Yang mengubah tabel:** {', '.join(used_inserts)}\n"
    else:
        report += "- **Form Input:** Tidak ditemukan form langsung di halaman ini (Mungkin view-only).\n"
        
    report += "\n"

with open(os.path.join(base_dir, '4_Alur_Data_Tabel_dan_Form.md'), 'w') as f:
    f.write(report)

print("Report 4 berhasil digenerate.")

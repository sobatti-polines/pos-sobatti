import os
import re
import json

base_dir = '/home/haydar/Code/POS/app'
directories_to_scan = ['app', 'components', 'lib', 'stores', 'supabase', '.']

files_data = []

# Read database.MD if available
db_schema = "Database Schema not found."
db_path = os.path.join(base_dir, 'database.MD')
if os.path.exists(db_path):
    with open(db_path, 'r', encoding='utf-8') as f:
        db_schema = f.read()

# Gather files
for d in directories_to_scan:
    dir_path = os.path.join(base_dir, d)
    if not os.path.isdir(dir_path):
        continue
    for root, dirs, files in os.walk(dir_path):
        if 'node_modules' in root or '.next' in root or '.git' in root or '.venv' in root:
            continue
        for f in files:
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.sql', '.md', '.MD', '.json', '.mjs')):
                continue
            file_path = os.path.join(root, f)
            rel_path = os.path.relpath(file_path, base_dir)
            # prevent duplicate root files
            if any(fd['path'] == rel_path for fd in files_data):
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    files_data.append({
                        'path': rel_path,
                        'content': content,
                        'lines': len(content.splitlines())
                    })
            except Exception:
                pass

def extract_api_details(content):
    # Try to find Request and Response types or usages
    requests_matches = re.findall(r'req\.json\(\)|request\.json\(\)', content)
    search_params = re.findall(r'searchParams\.get\([\'"]([^\'"]+)[\'"]\)', content)
    responses = re.findall(r'NextResponse\.json\((.*?)\)', content, re.DOTALL)
    
    return {
        'has_body': len(requests_matches) > 0,
        'search_params': search_params,
        'responses': [r.strip()[:100] + '...' if len(r) > 100 else r.strip() for r in responses]
    }

def extract_forms_and_tables(content):
    tables = set(re.findall(r'\.from\([\'"]([a-zA-Z0-9_]+)[\'"]\)', content))
    rpc = set(re.findall(r'\.rpc\([\'"]([a-zA-Z0-9_]+)[\'"]\)', content))
    fetches = set(re.findall(r'fetch\([\'"`]([^\'"`]+)[\'"`]', content))
    use_form = re.findall(r'useForm(?:<[^>]+>)?\(\{([^}]+)\}\)', content, re.DOTALL)
    
    form_fields = []
    if use_form:
        # crude extraction of defaultValues keys
        fields = re.findall(r'([a-zA-Z0-9_]+):\s', use_form[0])
        form_fields = list(set(fields))
        
    return {
        'tables': list(tables),
        'rpc': list(rpc),
        'fetches': list(fetches),
        'is_form': 'useForm' in content or '<form' in content,
        'form_fields': form_fields
    }

# 1. Analisis Routes (API & Pages)
routes_report = "# 1. Arsitektur dan Routes\n\n"
for file in sorted(files_data, key=lambda x: x['path']):
    path = file['path']
    if path.startswith('app/') and path.endswith(('page.tsx', 'route.ts')):
        route = path.replace('app/', '/').replace('/page.tsx', '').replace('/route.ts', '').replace('app', '')
        if route == '': route = '/'
        routes_report += f"## Route: `{route}`\n"
        routes_report += f"- **File**: `{path}`\n"
        
        details = extract_api_details(file['content'])
        tables_info = extract_forms_and_tables(file['content'])
        
        if path.endswith('route.ts'):
            routes_report += f"- **Tipe**: API Endpoint\n"
            routes_report += f"- **Menerima JSON Body?**: {'Ya' if details['has_body'] else 'Tidak'}\n"
            if details['search_params']:
                routes_report += f"- **Query Params**: {', '.join(details['search_params'])}\n"
            if details['responses']:
                routes_report += "- **Contoh Response JSON**:\n"
                for r in details['responses']:
                    # clean up linebreaks
                    clean_r = r.replace('\n', ' ')
                    routes_report += f"  - `{clean_r}`\n"
        else:
            routes_report += f"- **Tipe**: UI Page\n"
            
        if tables_info['fetches']:
            routes_report += f"- **Fetch Calls (External/Internal API)**:\n"
            for f in tables_info['fetches']:
                routes_report += f"  - `{f}`\n"
                
        if tables_info['tables']:
            routes_report += f"- **Akses Supabase Tables**: {', '.join(tables_info['tables'])}\n"
        if tables_info['rpc']:
            routes_report += f"- **Akses Supabase RPC (Function)**: {', '.join(tables_info['rpc'])}\n"
            
        routes_report += "\n"

# 2. Database dan Mapping Form
db_mapping_report = "# 2. Database dan Pemetaan Form\n\n"
db_mapping_report += "Analisis ini memetakan tabel pada database ke komponen/form mana yang berinteraksi dengannya.\n\n"

# extract tables from db_schema
table_names = set(re.findall(r'## Table `([a-zA-Z0-9_]+)`', db_schema))
table_mapping = {t: {'pages': [], 'components': [], 'api': [], 'lib': [], 'fields': set()} for t in table_names}

# also collect those implicitly called
all_found_tables = set()

for file in files_data:
    path = file['path']
    info = extract_forms_and_tables(file['content'])
    for t in info['tables']:
        all_found_tables.add(t)
        if t not in table_mapping:
            table_mapping[t] = {'pages': [], 'components': [], 'api': [], 'lib': [], 'fields': set()}
            
        if path.startswith('app/api'):
            table_mapping[t]['api'].append(path)
        elif path.startswith('app/') and path.endswith('page.tsx'):
            table_mapping[t]['pages'].append(path)
        elif path.startswith('components/') or 'form' in path or 'client' in path:
            table_mapping[t]['components'].append(path)
            if info['is_form'] and info['form_fields']:
                table_mapping[t]['fields'].update(info['form_fields'])
        elif path.startswith('lib/'):
            table_mapping[t]['lib'].append(path)
        else:
            table_mapping[t]['components'].append(path)

for t in sorted(table_mapping.keys()):
    db_mapping_report += f"## Tabel: `{t}`\n"
    data = table_mapping[t]
    if data['pages']:
        db_mapping_report += f"- **Pages**: {', '.join(data['pages'])}\n"
    if data['components']:
        db_mapping_report += f"- **Components/Forms**: {', '.join(data['components'])}\n"
    if data['api']:
        db_mapping_report += f"- **API Routes**: {', '.join(data['api'])}\n"
    if data['lib']:
        db_mapping_report += f"- **Lib/Utils**: {', '.join(data['lib'])}\n"
    if data['fields']:
        db_mapping_report += f"- **Field Form yang Terdeteksi**: {', '.join(data['fields'])}\n"
    if not any([data['pages'], data['components'], data['api'], data['lib']]):
        db_mapping_report += "- *Tabel ini belum terdeteksi penggunaannya secara eksplisit di kode frontend/backend.*"
    db_mapping_report += "\n\n"

# 3. Exhaustive File Details
file_details_report = "# 3. Detail Ekstensif Seluruh File Kode\n\n"
file_details_report += f"Total File yang Dianalisis: {len(files_data)}\n\n"

for file in sorted(files_data, key=lambda x: x['path']):
    path = file['path']
    info = extract_forms_and_tables(file['content'])
    
    file_details_report += f"### `{path}`\n"
    file_details_report += f"- **Baris Kode**: {file['lines']}\n"
    if info['is_form']:
        file_details_report += f"- **Fungsi**: Form Component\n"
        if info['form_fields']:
             file_details_report += f"- **Fields**: {', '.join(info['form_fields'])}\n"
    else:
        file_details_report += f"- **Fungsi**: Modul/Komponen/UI\n"
        
    if info['tables']:
        file_details_report += f"- **Tabel Supabase**: {', '.join(info['tables'])}\n"
    if info['rpc']:
        file_details_report += f"- **RPC Supabase**: {', '.join(info['rpc'])}\n"
    if info['fetches']:
        file_details_report += f"- **Fetch**: {', '.join(info['fetches'])}\n"
    file_details_report += "\n"

# Save reports
with open(os.path.join(base_dir, '1_Arsitektur_dan_Routes.md'), 'w') as f:
    f.write(routes_report)
with open(os.path.join(base_dir, '2_Database_dan_Form_Mapping.md'), 'w') as f:
    f.write(db_mapping_report)
with open(os.path.join(base_dir, '3_Detail_Semua_File_Kode.md'), 'w') as f:
    f.write(file_details_report)

print("Laporan berhasil digenerate.")

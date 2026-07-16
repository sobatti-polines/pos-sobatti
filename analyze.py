import os
import re
import json

base_dir = '/home/haydar/Code/POS/app'
directories_to_scan = ['app', 'components', 'lib', 'stores', 'supabase']

markdown_files = [f for f in os.listdir(base_dir) if f.endswith('.md') or f.endswith('.MD')]

files_data = []

for d in directories_to_scan:
    dir_path = os.path.join(base_dir, d)
    if not os.path.exists(dir_path):
        continue
    for root, dirs, files in os.walk(dir_path):
        for f in files:
            if 'node_modules' in root or '.next' in root:
                continue
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.sql')):
                continue
            file_path = os.path.join(root, f)
            with open(file_path, 'r', encoding='utf-8') as file:
                try:
                    content = file.read()
                except UnicodeDecodeError:
                    continue
            
            rel_path = os.path.relpath(file_path, base_dir)
            files_data.append({
                'path': rel_path,
                'content': content
            })

# 1. Routes & Features
routes = []
for file in files_data:
    if file['path'].startswith('app/') and (file['path'].endswith('page.tsx') or file['path'].endswith('route.ts')):
        route_path = file['path'].replace('app/app/', '/').replace('/page.tsx', '').replace('/route.ts', '')
        if route_path == 'app/page.tsx':
            route_path = '/'
        routes.append({'path': file['path'], 'route': route_path, 'content': file['content']})

# Extract Fetch / Supabase requests
def extract_requests(content):
    requests = []
    # Supabase queries
    supabase_queries = re.findall(r'\.from\([\'"]([a-zA-Z0-9_]+)[\'"]\)(?:\.select|\.insert|\.update|\.delete)', content)
    # Generic fetches
    fetches = re.findall(r'fetch\([\'"]([^\'"]+)[\'"]', content)
    return {'supabase_tables': list(set(supabase_queries)), 'fetches': list(set(fetches))}

# 2. Database & Forms
def extract_forms(content):
    forms = []
    # find form declarations
    if 'useForm' in content or '<form' in content:
        # trying to guess which tables this form interacts with
        tables = extract_requests(content)['supabase_tables']
        return tables
    return []

with open(os.path.join(base_dir, 'laporan_analisis_sistem.md'), 'w', encoding='utf-8') as out:
    out.write('# Laporan Komprehensif POS Sobatti\n\n')
    
    out.write('## 1. Daftar Routes & Fitur\n\n')
    for route in routes:
        out.write(f'### Route: `{route["route"]}`\n')
        out.write(f'- **File**: `{route["path"]}`\n')
        reqs = extract_requests(route['content'])
        out.write(f'- **Supabase Tables Interacted**: {", ".join(reqs["supabase_tables"]) if reqs["supabase_tables"] else "None"}\n')
        out.write(f'- **Fetch Calls**: {", ".join(reqs["fetches"]) if reqs["fetches"] else "None"}\n\n')

    out.write('## 2. Tabel Database dan Sumber Data Form\n\n')
    
    # map tables to forms
    table_to_forms = {}
    for file in files_data:
        forms = extract_forms(file['content'])
        reqs = extract_requests(file['content'])
        
        tables_in_file = set(reqs['supabase_tables'] + forms)
        for t in tables_in_file:
            if t not in table_to_forms:
                table_to_forms[t] = []
            table_to_forms[t].append(file['path'])
            
    for table, sources in table_to_forms.items():
        out.write(f'### Tabel: `{table}`\n')
        out.write('- **Sumber Data / Modifikasi (Pages/Components)**:\n')
        for s in set(sources):
            out.write(f'  - `{s}`\n')
        out.write('\n')

    out.write('## 3. Detail File Code Lengkap\n\n')
    for file in files_data:
        out.write(f'### File: `{file["path"]}`\n')
        reqs = extract_requests(file['content'])
        has_form = 'useForm' in file['content'] or '<form' in file['content']
        out.write(f'- **Tipe/Fungsi**: {"Form Component" if has_form else "Komponen / Utilitas"}\n')
        if reqs['supabase_tables']:
            out.write(f'- **Interaksi Tabel**: {", ".join(reqs["supabase_tables"])}\n')
        out.write('\n')

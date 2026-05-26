const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputClassesToRemove = [
  'bg-background',
  'shadow-sm',
  'h-10',
  'border-border',
  'border-input',
  'focus-visible:ring-primary/20',
  'focus-visible:border-primary',
  'transition-colors',
  'focus-visible:outline-none',
  'focus-visible:ring-1'
];

const selectClasses = 'flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50';

const textareaClasses = 'flex min-h-[100px] w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:opacity-50';

const checkboxClasses = 'h-4 w-4 rounded-[4px] border border-input text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary shadow-sm';

const rawInputClasses = 'flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-[15px] shadow-sm transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Process <Input className="...">
  const inputRegex = /<Input([^>]*)className=["']([^"']*)["']([^>]*)>/g;
  content = content.replace(inputRegex, (match, before, classStr, after) => {
    let classes = classStr.split(/\s+/).filter(Boolean);
    classes = classes.filter(c => !inputClassesToRemove.includes(c));
    if (classes.length === 0) {
      return `<Input${before}${after}>`;
    }
    return `<Input${before}className="${classes.join(' ')}"${after}>`;
  });

  // 2. Process <select ... className="..."> or add className if missing
  const selectRegex = /<select\b([^>]*)>/g;
  content = content.replace(selectRegex, (match, attrs) => {
    const classMatch = attrs.match(/className=["']([^"']*)["']/);
    let classesToKeep = [];
    if (classMatch) {
      let classes = classMatch[1].split(/\s+/).filter(Boolean);
      // Remove any that are part of the old layout
      classesToKeep = classes.filter(c => 
        !['w-full', 'h-10', 'rounded-lg', 'rounded-md', 'border', 'border-border', 'border-input', 'bg-background', 'px-3', 'py-1.5', 'py-2', 'text-sm', 'text-foreground', 'appearance-none', 'cursor-pointer', 'shadow-sm', 'transition-colors', 'focus-visible:outline-none', 'focus-visible:ring-1', 'focus-visible:ring-primary/20', 'focus-visible:border-primary', 'text-muted-foreground'].includes(c)
      );
      
      attrs = attrs.replace(/className=["'][^"']*["']\s*/, '');
    }
    const finalClasses = [selectClasses, ...classesToKeep].join(' ');
    return `<select ${attrs.trim()} className="${finalClasses}">`;
  });

  // 3. Process <textarea ... className="...">
  const textareaRegex = /<textarea\b([^>]*)>/g;
  content = content.replace(textareaRegex, (match, attrs) => {
    const classMatch = attrs.match(/className=["']([^"']*)["']/);
    let classesToKeep = [];
    if (classMatch) {
      let classes = classMatch[1].split(/\s+/).filter(Boolean);
      classesToKeep = classes.filter(c => 
        !['w-full', 'min-h-[100px]', 'rounded-md', 'border', 'border-input', 'bg-background', 'px-3', 'py-2', 'text-sm', 'shadow-sm', 'transition-colors', 'focus-visible:outline-none', 'focus-visible:ring-1', 'focus-visible:ring-primary/20', 'focus-visible:border-primary'].includes(c)
      );
      attrs = attrs.replace(/className=["'][^"']*["']\s*/, '');
    }
    const finalClasses = [textareaClasses, ...classesToKeep].join(' ');
    return `<textarea ${attrs.trim()} className="${finalClasses}">`;
  });

  // 4. Process raw <input ...>
  // We need to differentiate checkbox vs hidden vs text
  const rawInputTagRegex = /<input\b([^>]*)>/g;
  content = content.replace(rawInputTagRegex, (match, attrs) => {
    if (attrs.includes('type="hidden"')) return match;

    const classMatch = attrs.match(/className=["']([^"']*)["']/);
    let currentClasses = [];
    if (classMatch) {
      currentClasses = classMatch[1].split(/\s+/).filter(Boolean);
      attrs = attrs.replace(/className=["'][^"']*["']\s*/, '');
    }

    if (attrs.includes('type="checkbox"')) {
       // Checkbox
       let classesToKeep = currentClasses.filter(c => 
         !['w-4', 'h-4', 'rounded', 'rounded-[4px]', 'border-gray-300', 'border', 'border-input', 'text-primary', 'focus:ring-primary', 'focus-visible:outline-none', 'focus-visible:ring-1', 'focus-visible:ring-primary/20', 'focus-visible:border-primary', 'shadow-sm'].includes(c)
       );
       const finalClasses = [checkboxClasses, ...classesToKeep].join(' ');
       return `<input ${attrs.trim()} className="${finalClasses}">`;
    } else {
       // Other raw inputs (text, number, date, etc)
       let classesToKeep = currentClasses.filter(c => 
         !['h-10', 'rounded-md', 'border', 'border-input', 'bg-background', 'px-3', 'py-2', 'text-sm', 'shadow-sm', 'transition-colors', 'focus-visible:outline-none', 'focus-visible:ring-1', 'focus-visible:ring-primary/20', 'focus-visible:border-primary'].includes(c)
       );
       const finalClasses = [rawInputClasses, ...classesToKeep].join(' ');
       return `<input ${attrs.trim()} className="${finalClasses}">`;
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (stat.isFile() && fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'app'));
walkDir(path.join(__dirname, 'components'));

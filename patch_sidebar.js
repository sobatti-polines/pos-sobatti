const fs = require('fs');
let code = fs.readFileSync('components/dashboard-sidebar.tsx', 'utf8');

code = code.replace(
  /<Link href="\/dashboard\/tutup-kasir" className=\{linkClass\("\/dashboard\/tutup-kasir"\)\} prefetch=\{true\}>\s*<Calculator className="w-5 h-5" \/>\s*<span className="text-sm">Kas Kasir<\/span>\s*<NavLinkPending \/>\s*<\/Link>/g,
  `<Link href="/dashboard/buka-kasir" className={linkClass("/dashboard/buka-kasir")} prefetch={true}>
              <Wallet className="w-5 h-5" />
              <span className="text-sm">Buka Kasir</span>
              <NavLinkPending />
            </Link>
            <Link href="/dashboard/tutup-kasir" className={linkClass("/dashboard/tutup-kasir")} prefetch={true}>
              <Calculator className="w-5 h-5" />
              <span className="text-sm">Tutup Kasir</span>
              <NavLinkPending />
            </Link>`
);

fs.writeFileSync('components/dashboard-sidebar.tsx', code);

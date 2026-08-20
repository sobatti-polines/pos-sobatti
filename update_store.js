const fs = require('fs');

const path = 'stores/pos-store.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Update CartItem interface
content = content.replace(
  'tipe_harga: "Satuan" | "Grosir" | "Promo";\n}',
  'tipe_harga: "Satuan" | "Grosir" | "Promo";\n  harga_jual_custom?: number;\n}'
);

// 2. Add setCustomPrice to PosState
content = content.replace(
  'setSellUnit: (satuanJual: string | null) => void;\n',
  'setSellUnit: (satuanJual: string | null) => void;\n  setCustomPrice: (id_produk: number, satuan_jual: string | null, customPrice: number) => void;\n'
);

// 3. Add setCustomPrice implementation
const impl = `
  setCustomPrice: (id_produk, satuan_jual, customPrice) =>
    set((state) => ({
      cart: state.cart.map((i) =>
        i.id_produk === id_produk && i.satuan_jual === satuan_jual
          ? { ...i, harga_jual_custom: customPrice, harga_jual: customPrice }
          : i
      ),
    })),
`;

content = content.replace(
  'setSellUnit: (satuanJual) =>',
  impl + '\n  setSellUnit: (satuanJual) =>'
);

// 4. Update checkout payload map
content = content.replace(
  'tipe_harga: i.tipe_harga,\n        })),',
  'tipe_harga: i.tipe_harga,\n          harga_jual_custom: i.harga_jual_custom,\n        })),'
);

// 5. Keep custom price in setPriceType if calculated price is 0
content = content.replace(
  'if (type === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;\n      }',
  `if (type === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;\n      }
      if (newPrice === 0 && item.harga_jual_custom !== undefined) newPrice = item.harga_jual_custom;`
);

// 6. Keep custom price in setSellUnit if calculated price is 0
content = content.replace(
  'if (item.tipe_harga === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;\n      }',
  `if (item.tipe_harga === "Promo" && product.harga_jual_promo != null) newPrice = product.harga_jual_promo;\n      }
      if (newPrice === 0 && item.harga_jual_custom !== undefined) newPrice = item.harga_jual_custom;`
);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated stores/pos-store.ts");

## Goal Description
The owner/admin users are experiencing lag when navigating to pages, typing in input forms, and scrolling, particularly when they select "Semua" (All) in the data table pagination. This causes the browser to render thousands of complex DOM nodes simultaneously, leading to:
1. **Scrolling Lag**: The browser struggles with layout and painting when there are thousands of rows.
2. **Typing Lag in Forms**: The input forms (e.g., search, edit modals, fill stock modals) have their state tied to the parent component. When typing, the parent component re-renders, which in turn synchronously re-renders the entire 1000+ row table on every keystroke.
3. **Navigation Lag**: Rendering the initial large tree blocks the main thread.

We will resolve this by:
1. **Removing the "Semua" (0) option** from the pagination dropdown globally in `DataTable` and replacing it with a maximum limit (e.g., 250 and 500). This protects the DOM from being overloaded.
2. **Optimizing the Search Input** in `DataTable` to use local state and `startTransition`, ensuring that typing feels instant even if the table below is processing a large filter.

## User Review Required
> [!WARNING]
> Opsi "Semua" pada dropdown baris per halaman akan dihapus dan diganti dengan opsi "250" dan "500" untuk mencegah browser ngelag akibat me-render ribuan baris sekaligus. Apakah tidak masalah jika maksimal data yang bisa dilihat dalam satu halaman dibatasi hingga 500 baris?

## Proposed Changes

### `components/data-table.tsx`
#### [MODIFY] data-table.tsx
- Add local state for the search input to prevent typing lag.
- Wrap the search change handler in `startTransition`.
- Replace the `<option value={0}>Semua</option>` with `<option value={250}>250</option>` and `<option value={500}>500</option>`.

```tsx
// Di dalam DataTable:
const [localSearch, setLocalSearch] = React.useState(search ?? "")
React.useEffect(() => {
  setLocalSearch(search ?? "")
}, [search])

const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setLocalSearch(e.target.value)
  React.startTransition(() => {
    onSearchChange?.(e.target.value)
  })
}

// Pada render Input search:
<Input
  aria-label="Pencarian"
  placeholder={searchPlaceholder}
  className="pl-9 rounded-md w-full"
  value={localSearch}
  onChange={handleSearchChange}
  disabled={isInEditMode}
/>

// Pada render dropdown pagination:
<select ...>
  {[10, 25, 50, 100, 250, 500].map((n) => (
    <option key={n} value={n}>
      {n}
    </option>
  ))}
</select>
```

## Verification Plan
### Manual Verification
1. Buka halaman Inventaris (`/dashboard/inventory`).
2. Ubah baris per halaman ke maksimum (500).
3. Coba ketik di kolom pencarian tabel, pastikan tidak ada lag (huruf muncul instan).
4. Coba ketik di form Edit Produk atau form lainnya, pastikan tidak ada lag.
5. Coba scroll tabel, pastikan lebih lancar dari sebelumnya.

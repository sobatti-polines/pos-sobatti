"use client"

import React from "react"
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SortConfig } from "@/hooks/use-table"

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  sortKey?: string
  render?: (item: T) => React.ReactNode
  className?: string
  headerClassName?: string
  mobileLabel?: string
  mobileHide?: boolean
  align?: "left" | "center" | "right"
}

export interface SelectFilter {
  type: "select"
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}

export interface DateRangeFilter {
  type: "date-range"
  start: string
  end: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

export interface CustomFilter {
  type: "custom"
  render: () => React.ReactNode
}

export type FilterDef = SelectFilter | DateRangeFilter | CustomFilter

export interface ActionDef {
  label: string
  icon?: React.ReactNode
  variant?: "outline" | "default" | "destructive" | "ghost" | "secondary"
  onClick: () => void
  disabled?: boolean
  kind?: "default" | "primary"
}

export interface DeleteModalConfig {
  open: boolean
  title?: string
  itemName?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  error?: string
}

export interface EmptyStateConfig {
  icon: React.ElementType
  title: string
  description?: string
}

export interface DataTableProps<T> {
  data: T[]
  total: number
  columns: Column<T>[]
  rowKey: (item: T) => string | number

  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string

  sortConfig?: SortConfig | null
  onSort?: (key: string) => void

  currentPage?: number
  onPageChange?: (page: number) => void
  itemsPerPage?: number
  onItemsPerPageChange?: (itemsPerPage: number) => void

  filters?: FilterDef[]
  actions?: ActionDef[]

  topContent?: React.ReactNode
  errorBanner?: string | null

  emptyState?: EmptyStateConfig

  editingId?: number | "new" | null
  renderEditRow?: (item: T | null) => React.ReactNode
  renderEditExpanded?: (item: T | null) => React.ReactNode

  onRowClick?: (item: T) => void

  deleteModal?: DeleteModalConfig

  mobileCards?: boolean
  mobileBreakpoint?: "md" | "lg" | "xl"

  loading?: boolean
  className?: string
}

function SortIcon({
  columnKey,
  sortConfig,
}: {
  columnKey: string
  sortConfig?: SortConfig | null
}) {
  if (sortConfig?.key !== columnKey) {
    return <ChevronDown className="w-3 h-3 opacity-20 ml-1 inline-block" />
  }
  return sortConfig.direction === "asc" ? (
    <ChevronUp className="w-3 h-3 text-foreground ml-1 inline-block" />
  ) : (
    <ChevronDown className="w-3 h-3 text-foreground ml-1 inline-block" />
  )
}

export default function DataTable<T>({
  data,
  total,
  columns,
  rowKey,
  search,
  onSearchChange,
  searchPlaceholder = "Cari...",
  sortConfig,
  onSort,
  currentPage,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  filters,
  actions,
  topContent,
  errorBanner,
  emptyState,
  editingId,
  renderEditRow,
  renderEditExpanded,
  onRowClick,
  deleteModal,
  mobileCards = false,
  mobileBreakpoint = "md",
  loading,
  className,
}: DataTableProps<T>) {
  const bp = mobileBreakpoint
  const perPage = itemsPerPage || 25
  const page = currentPage || 1
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const showToolbar =
    search !== undefined ||
    (filters && filters.length > 0) ||
    (actions && actions.length > 0)

  const startRecord = total === 0 ? 0 : (page - 1) * perPage + 1
  const endRecord = Math.min(page * perPage, total)

  const isInEditMode = editingId !== undefined && editingId !== null

  const getRowBaseClass = () => {
    if (!mobileCards) return "group hover:bg-muted/30 transition-colors"
    if (bp === "md") return "group hover:bg-muted/30 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b hover:bg-muted/30"
    if (bp === "lg") return "group hover:bg-muted/30 transition-colors flex flex-col lg:table-row p-4 lg:p-0 border-b hover:bg-muted/30"
    if (bp === "xl") return "group hover:bg-muted/30 transition-colors flex flex-col xl:table-row p-4 xl:p-0 border-b hover:bg-muted/30"
    return ""
  }

  const getCellBaseClass = () => {
    if (!mobileCards) return "p-1.5 md:p-2"
    if (bp === "md") return "p-0 md:p-2 py-2 md:py-4 block md:table-cell"
    if (bp === "lg") return "p-0 lg:p-2 py-2 lg:py-4 block lg:table-cell"
    if (bp === "xl") return "p-0 xl:p-2 py-2 xl:py-4 block xl:table-cell"
    return ""
  }

  const getHeaderVisibilityClass = () => {
    if (!mobileCards) return ""
    if (bp === "md") return "hidden md:table-header-group"
    if (bp === "lg") return "hidden lg:table-header-group"
    if (bp === "xl") return "hidden xl:table-header-group"
    return ""
  }

  const getMobileHideClass = () => {
    if (!mobileCards) return ""
    if (bp === "md") return "hidden md:table-cell"
    if (bp === "lg") return "hidden lg:table-cell"
    if (bp === "xl") return "hidden xl:table-cell"
    return ""
  }

  return (
    <div
      className={cn(
        "flex-1 flex flex-col min-h-0 bg-background border border-border rounded-[12px] shadow-[0_1px_3px_rgba(0,55,112,0.08)] overflow-hidden relative",
        className
      )}
    >
      {/* Toolbar (with optional topContent inside same bordered section) */}
      {(topContent || showToolbar) && (
        <div className="shrink-0 p-4 lg:p-6 border-b border-border bg-transparent">
          <div className={cn(topContent && showToolbar && "flex flex-col gap-6")}>
            {topContent && <div>{topContent}</div>}

            {showToolbar && (
              <div className="flex flex-col items-start md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
                  {search !== undefined && (
                    <div className="relative w-full md:max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        aria-label="Pencarian"
                        placeholder={searchPlaceholder}
                        className="pl-9 rounded-md w-full"
                        value={search}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        disabled={isInEditMode}
                      />
                    </div>
                  )}

                  {filters && filters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      {filters.map((filter, i) => {
                        if (filter.type === "select") {
                          return (
                            <select
                              key={i}
                              aria-label={filter.label}
                              value={filter.value}
                              onChange={(e) => filter.onChange(e.target.value)}
                              disabled={isInEditMode}
                              className="h-10 w-full md:w-auto rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-muted-foreground disabled:opacity-50"
                            >
                              <option value="all">
                                {filter.placeholder || `Semua ${filter.label}`}
                              </option>
                              {filter.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )
                        }
                        if (filter.type === "date-range") {
                          return (
                            <div key={i} className="flex items-center gap-2 w-full md:w-auto">
                              <Input
                                type="date"
                                disabled={isInEditMode}
                                className="rounded-md border px-3 py-2 text-sm w-full md:w-40 h-10 disabled:opacity-50"
                                value={filter.start}
                                onChange={(e) => filter.onStartChange(e.target.value)}
                              />
                              <span className="text-muted-foreground text-sm">s/d</span>
                              <Input
                                type="date"
                                disabled={isInEditMode}
                                className="rounded-md border px-3 py-2 text-sm w-full md:w-40 h-10 disabled:opacity-50"
                                value={filter.end}
                                onChange={(e) => filter.onEndChange(e.target.value)}
                              />
                            </div>
                          )
                        }
                        if (filter.type === "custom") {
                          return <div key={i}>{filter.render()}</div>
                        }
                        return null
                      })}
                    </div>
                  )}
                </div>

                {actions && actions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 md:ml-4 shrink-0 w-full md:w-auto">
                    {actions.map((action, i) => (
                      <Button
                        key={i}
                        variant={
                          action.kind === "primary"
                            ? "default"
                            : action.variant || "outline"
                        }
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className={cn(
                          "rounded-full",
                          action.kind === "primary"
                            ? "px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal shrink-0 gap-2"
                            : action.kind
                              ? ""
                              : "px-4 h-10 gap-2",
                          "flex-1 md:flex-none"
                        )}
                      >
                        {action.icon}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-border text-destructive text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorBanner}
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <Table>
          <TableHeader
            className={cn(getHeaderVisibilityClass())}
          >
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.sortable &&
                      "cursor-pointer select-none hover:text-foreground transition-colors",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.mobileHide && getMobileHideClass(),
                    col.headerClassName
                  )}
                  onClick={() => col.sortable && onSort?.(col.sortKey || col.key)}
                >
                  {col.header}
                  {col.sortable && (
                    <SortIcon columnKey={col.sortKey || col.key} sortConfig={sortConfig} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New item edit row */}
            {editingId === "new" && renderEditRow?.(null)}

            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-32 hover:bg-transparent"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-base text-muted-foreground">
                      Memuat data...
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 && editingId !== "new" ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-32 hover:bg-transparent"
                >
                  {emptyState ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <emptyState.icon className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-base font-medium text-foreground">
                        {emptyState.title}
                      </p>
                      {emptyState.description && (
                        <p className="text-sm mt-1 text-muted-foreground">
                          {emptyState.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-base text-muted-foreground">
                      Tidak ada data
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                const id = rowKey(item)
                const isEditingThis =
                  isInEditMode && editingId === id

                if (isEditingThis) {
                  return (
                    <React.Fragment key={id}>
                      {renderEditRow?.(item)}
                      {renderEditExpanded?.(item)}
                    </React.Fragment>
                  )
                }

                return (
                  <TableRow
                    key={id}
                    className={cn(
                      getRowBaseClass(),
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((col) => {
                      const cellContent = col.render
                        ? col.render(item)
                        : String(
                            (item as Record<string, unknown>)[col.key] ?? ""
                          )

                      return (
                        <TableCell
                          key={col.key}
                          className={cn(
                            getCellBaseClass(),
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.mobileHide && getMobileHideClass(),
                            col.className
                          )}
                        >
                          {mobileCards && col.mobileLabel && (
                            <span
                              className={`${bp}:hidden text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block`}
                            >
                              {col.mobileLabel}
                            </span>
                          )}
                          {cellContent}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {onPageChange && (
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 lg:p-6 border-t border-border bg-background">
          <p className="text-[13px] text-muted-foreground tabular-nums">
            Menampilkan{" "}
            <span className="font-medium text-foreground">{startRecord}</span>{" "}
            hingga{" "}
            <span className="font-medium text-foreground">{endRecord}</span> dari{" "}
            <span className="font-medium text-foreground">{total}</span> data
          </p>
          <div className="flex items-center gap-3">
            {onItemsPerPageChange && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground whitespace-nowrap">
                  Baris per halaman
                </span>
                <select
                  aria-label="Baris per halaman"
                  value={perPage}
                  onChange={(e) => {
                    onItemsPerPageChange(Number(e.target.value))
                    onPageChange?.(1)
                  }}
                  disabled={isInEditMode}
                  className="h-8 rounded-md border border-border bg-background px-2 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 text-foreground disabled:opacity-50"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <span className="text-[13px] text-muted-foreground tabular-nums whitespace-nowrap">
              Halaman{" "}
              <span className="font-medium text-foreground">{page}</span> /{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1">
              <Button
                aria-label="Halaman Sebelumnya"
                variant="outline"
                size="sm"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              disabled={page <= 1 || isInEditMode}
              className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              aria-label="Halaman Selanjutnya"
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isInEditMode}
                className="h-11 w-11 md:h-8 md:w-8 p-0 rounded-full bg-background disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] rounded-[12px] w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] font-light tracking-tight text-foreground mb-2">
                {deleteModal.title || "Hapus Data?"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin menghapus{" "}
                <strong className="text-foreground">
                  {deleteModal.itemName || "item ini"}
                </strong>
                ? Tindakan ini tidak dapat dibatalkan.
              </p>
              {deleteModal.error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {deleteModal.error}
                </div>
              )}
            </div>
            <div className="shrink-0 px-6 py-5 border-t border-border bg-transparent flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-6 bg-background"
                onClick={deleteModal.onCancel}
                disabled={deleteModal.isPending}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-full px-6 shadow-sm"
                onClick={deleteModal.onConfirm}
                disabled={deleteModal.isPending}
              >
                {deleteModal.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {deleteModal.confirmLabel || "Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

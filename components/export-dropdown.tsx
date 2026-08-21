"use client"

import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Table } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ExportDropdownProps {
  onExportCSV?: () => void
  onExportExcel?: () => void
  onExportPDF?: () => void
  className?: string
  size?: "default" | "sm"
  disabled?: boolean
  isLoading?: boolean
}

export function ExportDropdown({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  className,
  size = "default",
  disabled = false,
  isLoading = false,
}: ExportDropdownProps) {
  // If only one export type is provided, just render a button
  if (onExportCSV && !onExportExcel && !onExportPDF) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("gap-2", className)}
        onClick={onExportCSV}
        disabled={disabled || isLoading}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {isLoading ? "Loading..." : "Export"}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn("gap-2", className)}
          disabled={disabled || isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isLoading ? "Loading..." : "Export"}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportExcel && (
          <DropdownMenuItem onSelect={onExportExcel}>
            <Table className="w-4 h-4 mr-2" />
            Export Excel
          </DropdownMenuItem>
        )}
        {onExportCSV && (
          <DropdownMenuItem onSelect={onExportCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </DropdownMenuItem>
        )}
        {onExportPDF && (
          <DropdownMenuItem onSelect={onExportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

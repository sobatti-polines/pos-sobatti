"use client"

import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"

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
  onExportPDF?: () => void
  className?: string
  size?: "default" | "sm"
  disabled?: boolean
  isLoading?: boolean
}

export function ExportDropdown({
  onExportCSV,
  onExportPDF,
  className,
  size = "default",
  disabled = false,
  isLoading = false,
}: ExportDropdownProps) {
  if (onExportCSV && !onExportPDF) {
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

  if (onExportPDF && !onExportCSV) {
    return (
      <Button
        variant="outline"
        size={size}
        className={cn("gap-2", className)}
        onClick={onExportPDF}
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
        {onExportCSV && (
          <DropdownMenuItem onSelect={onExportCSV}>
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </DropdownMenuItem>
        )}
        {onExportPDF && (
          <DropdownMenuItem onSelect={onExportPDF}>
            <FileText className="w-4 h-4" />
            Export PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

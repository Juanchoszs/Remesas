import * as React from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronDown } from "lucide-react"

type Tax = {
  id: string
  name: string
  percentage: number
  type: string
}

type TaxSelectorProps = {
  selectedTaxes: string[]
  onTaxChange: (taxIds: string[]) => void
  taxes: Tax[]
  disabled?: boolean
}

export function TaxSelector({ selectedTaxes = [], onTaxChange, taxes, disabled = false }: TaxSelectorProps) {
  const [open, setOpen] = React.useState(false)
  
  const handleTaxChange = (taxId: string, checked: boolean) => {
    const newSelectedTaxes = checked 
      ? [...selectedTaxes, taxId]
      : selectedTaxes.filter(id => id !== taxId)
    onTaxChange(newSelectedTaxes)
  }

  const getSelectedTaxesLabel = () => {
    if (selectedTaxes.length === 0) return "Seleccionar impuestos"
    if (selectedTaxes.length === 1) {
      const tax = taxes.find(t => t.id === selectedTaxes[0])
      return tax ? `${tax.name} (${tax.percentage}%)` : "1 impuesto"
    }
    return `${selectedTaxes.length} impuestos seleccionados`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{getSelectedTaxesLabel()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto p-2">
          {taxes.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2">No hay impuestos disponibles</div>
          ) : (
            <div className="space-y-2">
              {taxes.map((tax) => (
                <div key={tax.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                  <Checkbox
                    id={`tax-${tax.id}`}
                    checked={selectedTaxes.includes(tax.id)}
                    onCheckedChange={(checked) => handleTaxChange(tax.id, checked as boolean)}
                  />
                  <Label htmlFor={`tax-${tax.id}`} className="text-sm font-normal cursor-pointer w-full">
                    {tax.name} ({tax.percentage}%)
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

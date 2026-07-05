"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps {
  value: Date;
  onChange: (date: Date) => void;
}

// D-06: date defaults to today (parent form initializes `value` to
// `new Date()`), editable via this Popover+Calendar picker. Uses this repo's
// Base UI `render`-prop trigger idiom (matching components/ui/dialog.tsx),
// not the Radix `asChild` composition shown in generic shadcn tutorials.
export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" type="button" />}>
        {format(value, "PPP")}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date) {
              onChange(date);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

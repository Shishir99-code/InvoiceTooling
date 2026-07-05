"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface StudentComboboxOption {
  id: number;
  name: string;
  parentEmail: string;
  rateCents: number;
}

interface StudentComboboxProps {
  students: StudentComboboxOption[];
  value: StudentComboboxOption | null;
  onValueChange: (student: StudentComboboxOption | null) => void;
}

// D-04: student picker resolving duplicate names via the parentEmail
// disambiguator ("Name — parent email"). The selected object (never a name
// string) carries `id` for the hidden studentId form field and `rateCents`
// for the client-side amount preview — the Server Action still re-fetches
// rateCents authoritatively (Pitfall 1).
export function StudentCombobox({
  students,
  value,
  onValueChange,
}: StudentComboboxProps) {
  return (
    <Combobox
      items={students}
      itemToStringValue={(s) => `${s.name} — ${s.parentEmail}`}
      value={value}
      onValueChange={onValueChange}
    >
      <ComboboxInput placeholder="Search student…" />
      <ComboboxContent>
        <ComboboxEmpty>No students found.</ComboboxEmpty>
        <ComboboxList>
          {(s: StudentComboboxOption) => (
            <ComboboxItem key={s.id} value={s}>
              {s.name} — {s.parentEmail}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

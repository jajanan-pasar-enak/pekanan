"use client";

import { useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Select milik Radix menahan fokus di trigger setelah memilih, sehingga blur
// (auto-save) baru terjadi saat user pindah ke kolom lain dan pilihan terakhir
// bisa hilang bila laporan langsung dikirim. Komponen ini melepas fokus segera
// setelah pilihan berubah; `onBlur` membaca nilai terbaru dari state.
export function SelectBaris({
  label,
  value,
  opsi,
  disabled,
  onChange,
  onBlur,
}: {
  label: string;
  value: string | null;
  opsi: readonly string[];
  disabled: boolean;
  onChange: (nilai: string) => void;
  onBlur: () => void;
}) {
  const dipilih = useRef(false);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => {
        dipilih.current = true;
        onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} onBlur={onBlur} className="w-full">
        <SelectValue placeholder="Pilih" />
      </SelectTrigger>
      <SelectContent
        onCloseAutoFocus={(event) => {
          if (!dipilih.current) return;
          dipilih.current = false;
          // Tunggu popup benar-benar tertutup, lalu lepaskan fokus agar
          // onBlur berjalan setelah state pilihan ter-render.
          event.preventDefault();
          setTimeout(() => (document.activeElement as HTMLElement | null)?.blur());
        }}
      >
        {opsi.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

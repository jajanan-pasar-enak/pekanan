"use client";

import { useRef, type KeyboardEvent } from "react";
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
// setelah pilihan berubah; bila dipilih lewat keyboard, fokus lanjut ke kolom
// berikutnya. `onBlur` membaca nilai terbaru dari state.
export function SelectBaris({
  label,
  value,
  opsi,
  disabled,
  dataKolom,
  onChange,
  onBlur,
  onKeyDown,
  onSelesai,
}: {
  label: string;
  value: string | null;
  opsi: readonly string[];
  disabled: boolean;
  dataKolom?: string;
  onChange: (nilai: string) => void;
  onBlur: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onSelesai?: () => void;
}) {
  const dipilih = useRef(false);
  const lewatKeyboard = useRef(false);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => {
        dipilih.current = true;
        onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={label}
        data-kolom={dataKolom}
        onBlur={onBlur}
        onPointerDown={() => {
          lewatKeyboard.current = false;
        }}
        onKeyDown={(e) => {
          if (!e.altKey && (e.key === "Enter" || e.key === " " || e.key.startsWith("Arrow"))) {
            lewatKeyboard.current = true;
          }
          onKeyDown?.(e);
        }}
        className="w-full"
      >
        <SelectValue placeholder="Pilih" />
      </SelectTrigger>
      <SelectContent
        onCloseAutoFocus={(event) => {
          if (!dipilih.current) return;
          dipilih.current = false;
          // Tunggu popup benar-benar tertutup, lalu pindahkan fokus. Blur pada
          // trigger tetap berjalan sehingga auto-save tidak terlewat.
          event.preventDefault();
          const lanjut = lewatKeyboard.current;
          lewatKeyboard.current = false;
          setTimeout(() => {
            if (lanjut && onSelesai) {
              onSelesai();
              return;
            }
            (document.activeElement as HTMLElement | null)?.blur();
          });
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

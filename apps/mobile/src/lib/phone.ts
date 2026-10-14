export type SmsDialCountry = "Cameroon" | "Nigeria";

/** Map profile / form text to dial plan used for SMS (matches server-side normalization). */
export function resolveSmsDialCountry(
  value: string | null | undefined,
): SmsDialCountry {
  const t = (value ?? "").trim().toLowerCase();
  if (t === "nigeria" || t.includes("nigeria") || t.includes("nigerian")) {
    return "Nigeria";
  }
  return "Cameroon";
}

/** Normalize mobile input to E.164 for Cameroon and Nigeria (matches server-side logic). */
export function normalizePhoneToE164(phone: string, country: string): string {
  const c = resolveSmsDialCountry(country);
  const digits = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (c === "Cameroon") {
    if (digits.startsWith("+237")) return digits;
    if (digits.startsWith("237")) return `+${digits}`;
    const national = digits.replace(/^0/, "");
    return `+237${national}`;
  }
  if (c === "Nigeria") {
    if (digits.startsWith("+234")) return digits;
    if (digits.startsWith("234")) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  }
  if (digits.startsWith("+")) return digits;
  return digits.startsWith("234") ? `+${digits}` : `+${digits}`;
}

/** Mask middle digits for display (e.g. +237 •••••8912). */
export function maskE164(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 6) return e164;
  const cc = d.slice(0, Math.min(4, d.length - 6));
  const tail = d.slice(-4);
  return `+${cc} ••••• ${tail}`;
}

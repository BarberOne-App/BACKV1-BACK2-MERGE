export function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

export function isValidLoginPhone(value?: string | null) {
  const phone = normalizePhone(value);
  return !!phone && phone.length >= 10 && phone.length <= 13;
}

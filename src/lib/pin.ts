/** Code trop facile à deviner : chiffre répété (111111) ou suite (123456, 987654). */
export function isWeakPin(pin: string): boolean {
  return /^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin);
}

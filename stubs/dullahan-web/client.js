export function ok(value) { return { ok: true, value }; }
export function serverActionValidationFail(error) { return { ok: false, error }; }
export function toUserMessage(err) { return String(err?.message ?? err); }
export function ClientPageProvider({ children }) { return children; }

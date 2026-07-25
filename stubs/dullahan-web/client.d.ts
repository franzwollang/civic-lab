export declare function ok<T>(value: T): { ok: true; value: T };
export declare function serverActionValidationFail(error: unknown): { ok: false; error: unknown };
export declare function toUserMessage(err: unknown): string;
export declare function ClientPageProvider(props: { children: unknown }): unknown;

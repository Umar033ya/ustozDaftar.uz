export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
  }
}

export function unauthorized(): never {
  throw new ApiError(401, "UNAUTHORIZED", "Tizimga kirish talab qilinadi.");
}

export function forbidden(code = "FORBIDDEN", message?: string): never {
  throw new ApiError(403, code, message);
}
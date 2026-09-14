import type { AppError } from "@contracts/types";

export class ReadingError extends Error implements AppError {
  constructor(
    public readonly code: AppError["code"],
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ReadingError";
  }
}

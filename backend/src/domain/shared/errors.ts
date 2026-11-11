export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'INVALID_REQUEST',
  ) {
    super(message);
  }
}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError(400, message);
}

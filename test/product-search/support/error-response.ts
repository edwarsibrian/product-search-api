/**
 * Shape of the JSON body for both `ProductSearchExceptionFilter` (domain
 * errors — `message` is always a single string) and Nest's default
 * `ValidationPipe` rejection (class-validator errors — `message` is an
 * array of strings). e2e assertions cast to this instead of touching
 * supertest's untyped `response.body` directly.
 */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

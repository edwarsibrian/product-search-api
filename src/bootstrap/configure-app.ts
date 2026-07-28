import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Application-wide setup shared between the real server (`main.ts`) and the
 * e2e test harness (`test/product-search/support/test-app.ts`). Keeping
 * this in one place means e2e tests exercise the exact same validation
 * behavior as production instead of a hand-copied approximation that could
 * silently drift.
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

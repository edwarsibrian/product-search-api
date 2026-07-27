import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ProductSearchModule } from './product-search/product-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    ProductSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

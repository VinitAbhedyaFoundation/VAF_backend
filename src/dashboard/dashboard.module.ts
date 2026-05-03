import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from 'src/auth/auth.module';        // ✅ ADD
import { DatabaseModule } from 'src/database/database.module'; // (if using prisma)

@Module({
  imports: [
    AuthModule,        // ✅ THIS FIXES jwt-user error
    DatabaseModule,    // ✅ needed for Prisma
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
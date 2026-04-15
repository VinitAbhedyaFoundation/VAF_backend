import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  constructor(private configService: ConfigService) {
    const dbUrl = configService.get<string>('DATABASE_URL');

    if (!dbUrl) {
      console.error('DATABASE_URL is not defined');
      process.exit(1);
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed');

      if (process.env.NODE_ENV === 'development') {
        console.error(error);
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 Database disconnected');
  }
}
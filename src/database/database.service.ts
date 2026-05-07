import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private configService: ConfigService,
  ) {
    const dbUrl =
      configService.get<string>(
        'DATABASE_URL',
      );

    if (!dbUrl) {
      throw new Error(
        'DATABASE_URL is not defined',
      );
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
    let retries = 5;

    while (retries) {
      try {
        await this.$connect();

        console.log(
          '✅ Database connected',
        );

        return;
      } catch (error) {
        retries--;

        console.log(
          `❌ DB connection failed... retries left: ${retries}`,
        );

        if (retries === 0) {
          console.error(
            '💥 Could not connect to DB',
          );

          throw error;
        }

        await new Promise((res) =>
          setTimeout(res, 3000),
        );
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();

    console.log(
      '🛑 Database disconnected',
    );
  }
}
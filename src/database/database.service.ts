import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(
    DatabaseService.name,
  );

  constructor(
    private readonly configService: ConfigService,
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

  async onModuleInit(): Promise<void> {
    let retries = 5;

    while (retries > 0) {
      try {
        await this.$connect();

        this.logger.log(
          'Database connected successfully.',
        );

        return;
      } catch (error) {
        retries--;

        this.logger.warn(
          `Database connection failed. Retries left: ${retries}`,
        );

        if (retries === 0) {
          this.logger.error(
            'Unable to connect to the database.',
            error instanceof Error
              ? error.stack
              : String(error),
          );

          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 3000),
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();

    this.logger.log(
      'Database disconnected.',
    );
  }
}
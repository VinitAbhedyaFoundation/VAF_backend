import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { DatabaseModule } from 'src/database/database.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    DatabaseModule, // 🔥 needed for DatabaseService
    MailModule,     // 🔥 needed for MailService
  ],
  controllers: [MessageController],
  providers: [MessageService],
})
export class MessageModule {}
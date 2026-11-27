
import { Module } from '@nestjs/common';
import { BirthdayService } from './birthday.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [BirthdayService],
})
export class BirthdayModule {}

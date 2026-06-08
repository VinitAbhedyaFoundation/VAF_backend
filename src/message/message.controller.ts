import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@Controller('message')
export class MessageController {
  constructor(
    private messageService: MessageService,
  ) {}

  @Get('all')
  getAll() {
    return this.messageService.getAll();
  }

  @Post('send')
  send(
    @Body()
    body: CreateMessageDto,
  ) {
    return this.messageService.send(
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  getNotifications(
    @Req() 
    req: any,
  ) {
    return this.messageService.getNotifications(
      req.user.id,
    );
  }
}
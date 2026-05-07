import { Controller, Get, Post, Body } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('message')
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get('all')
  getAll() {
    return this.messageService.getAll();
  }

  @Post('send')
  send(@Body() body: CreateMessageDto) {
    return this.messageService.send(body);
  }
}
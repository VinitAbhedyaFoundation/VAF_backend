import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { UserId } from '../common/decorator/user-id.decorator';

import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('Message')
@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
  ) {}

  @Get('all')
  @ApiOperation({
    summary: 'Get all messages',
  })
  getAll() {
    return this.messageService.getAll();
  }

  @Post('send')
  @ApiOperation({
    summary: 'Send a message',
  })
  send(
    @Body()
    body: CreateMessageDto,
  ) {
    return this.messageService.send(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  @ApiOperation({
    summary: 'Get notifications for logged-in user',
  })
  getNotifications(
    @UserId() userId: number,
  ) {
    return this.messageService.getNotifications(
      userId,
    );
  }
}
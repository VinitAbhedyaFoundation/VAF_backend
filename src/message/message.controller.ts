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

import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { UserId } from '../common/decorator/user-id.decorator';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('Message')
@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
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
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a message to a user' })
  async sendMessage(
    @CurrentUser() user: any,
    @Body() sendMessageDto: SendMessageDto
  ) {
    return this.messagesService.sendMessage(user.id, sendMessageDto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get list of my conversations' })
  async getMyConversations(@CurrentUser() user: any) {
    return this.messagesService.getMyConversations(user.id);
  }

  @Get('conversation/:userId')
  @ApiOperation({ summary: 'Get messages with a specific user' })
  @ApiParam({ name: 'userId', description: 'Other user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getMessagesWithUser(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.messagesService.getMessagesWithUser(
      user.id,
      userId,
      limit,
      offset
    );
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete my message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  async deleteMessage(
    @CurrentUser() user: any,
    @Param('messageId', ParseUUIDPipe) messageId: string
  ) {
    return this.messagesService.deleteMessage(messageId, user.id);
  }
}

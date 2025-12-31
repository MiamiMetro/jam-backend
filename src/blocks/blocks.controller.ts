import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Blocks')
@Controller('blocks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlocksController {
  constructor(private blocksService: BlocksService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'userId', description: 'ID of user to block' })
  async blockUser(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.blocksService.blockUser(user.id, userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'userId', description: 'ID of user to unblock' })
  async unblockUser(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.blocksService.unblockUser(user.id, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of blocked users' })
  async getBlockedUsers(@CurrentUser() user: any) {
    return this.blocksService.getBlockedUsers(user.id);
  }
}

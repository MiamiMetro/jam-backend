import {
  Controller,
  Post,
  Delete,
  Get,
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
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Post(':userId/request')
  @ApiOperation({ summary: 'Send a friend request to a user' })
  @ApiParam({
    name: 'userId',
    description: 'ID of user to send friend request to',
  })
  async requestFriend(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.friendsService.requestFriend(user.id, userId);
  }

  @Post(':userId/accept')
  @ApiOperation({ summary: 'Accept a friend request from a user' })
  @ApiParam({
    name: 'userId',
    description: 'ID of user whose request to accept',
  })
  async acceptFriendRequest(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.friendsService.acceptFriendRequest(user.id, userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a friend or cancel a friend request' })
  @ApiParam({ name: 'userId', description: 'ID of friend to remove' })
  async deleteFriend(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.friendsService.deleteFriend(user.id, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of all friends' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getFriends(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.friendsService.getFriends(user.id, limit, offset);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get list of pending friend requests' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getFriendRequests(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.friendsService.getFriendRequests(user.id, limit, offset);
  }
}

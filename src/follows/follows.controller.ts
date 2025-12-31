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
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Follows')
@Controller('follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({ name: 'userId', description: 'ID of user to follow' })
  async followUser(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.followsService.followUser(user.id, userId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({ name: 'userId', description: 'ID of user to unfollow' })
  async unfollowUser(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    return this.followsService.unfollowUser(user.id, userId);
  }

  @Get('following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of users I am following' })
  async getMyFollowing(@CurrentUser() user: any) {
    return this.followsService.getFollowing(user.id);
  }

  @Get('followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of my followers' })
  async getMyFollowers(@CurrentUser() user: any) {
    return this.followsService.getFollowers(user.id);
  }

  @Get(':userId/following')
  @ApiOperation({
    summary: 'Get list of users that a specific user is following (public)',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserFollowing(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.followsService.getUserFollowing(userId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get followers of a specific user (public)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserFollowers(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.followsService.getUserFollowers(userId);
  }
}

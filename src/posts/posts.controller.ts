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
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  async createPost(
    @CurrentUser() user: any,
    @Body() createPostDto: CreatePostDto
  ): Promise<PostResponseDto> {
    return this.postsService.createPost(user.id, createPostDto);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get following feed (posts from users I follow)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getFollowingFeed(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.postsService.getFollowingFeed(user.id, limit, offset);
  }

  @Get('discover')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get discover feed (public posts, For You)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getDiscoverFeed(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.postsService.getDiscoverFeed(user.id, limit, offset);
  }

  @Get(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single post by ID' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async getPost(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string
  ): Promise<PostResponseDto> {
    return this.postsService.getPostById(postId, user.id);
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my post' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async deletePost(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string
  ) {
    return this.postsService.deletePost(postId, user.id);
  }

  @Post(':postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like or unlike a post (toggle)' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async toggleLike(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string
  ) {
    return this.postsService.toggleLike(postId, user.id);
  }

  @Get(':postId/likes')
  @ApiOperation({ summary: 'Get list of users who liked a post (public)' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async getPostLikes(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.postsService.getPostLikes(postId);
  }
}

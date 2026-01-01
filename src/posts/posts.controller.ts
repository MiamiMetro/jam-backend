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
  HttpCode,
  HttpStatus,
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
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';

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
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get global feed (all posts)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getFeed(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.postsService.getFeed(user?.id, limit, offset);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':postId')
  @ApiOperation({ summary: 'Get a single post by ID (public)' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async getPost(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string
  ): Promise<PostResponseDto> {
    return this.postsService.getPostById(postId, user?.id);
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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

  @Get(':postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all comments for a post' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'asc',
    description: 'Order by timestamp (asc = oldest first, desc = newest first)',
  })
  async getComments(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('order') order?: 'asc' | 'desc'
  ) {
    return this.postsService.getComments(
      postId,
      user?.id,
      limit,
      offset,
      order || 'asc'
    );
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on a post' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  async createComment(
    @CurrentUser() user: any,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() createCommentDto: CreateCommentDto
  ): Promise<CommentResponseDto> {
    return this.postsService.createComment(postId, user.id, createCommentDto);
  }
}

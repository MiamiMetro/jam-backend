import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
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
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my profile' })
  async getMyProfile(@CurrentUser() user: any): Promise<ProfileResponseDto> {
    return this.profilesService.getMyProfile(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update my profile' })
  async updateMyProfile(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateProfileDto
  ): Promise<ProfileResponseDto> {
    return this.profilesService.updateProfile(user.id, updateDto);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get profile by username (public)' })
  @ApiParam({ name: 'username', example: 'johndoe' })
  async getProfileByUsername(
    @Param('username') username: string
  ): Promise<ProfileResponseDto> {
    return this.profilesService.getProfileByUsername(username);
  }

  @Get(':username/posts')
  @ApiOperation({ summary: 'Get posts by a specific user' })
  @ApiParam({ name: 'username', example: 'johndoe' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  async getPostsByUsername(
    @CurrentUser() user: any,
    @Param('username') username: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ) {
    return this.profilesService.getPostsByUsername(
      username,
      user?.id,
      limit,
      offset
    );
  }
}

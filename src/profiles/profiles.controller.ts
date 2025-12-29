import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Update my profile' })
  async updateMyProfile(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.updateProfile(user.id, updateDto);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get profile by username (public)' })
  @ApiParam({ name: 'username', example: 'johndoe' })
  async getProfileByUsername(
    @Param('username') username: string,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.getProfileByUsername(username);
  }
}
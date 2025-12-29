import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private supabaseService: SupabaseService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login and get access token' })
  async login(@Body() loginDto: LoginDto) {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      return { error: error.message };
    }

    return {
      access_token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async getMe(@CurrentUser() user: any) {
    return {
      userId: user.id,
      email: user.email,
    };
  }
}
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private supabaseService: SupabaseService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Supabase'de kullanıcı oluştur
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new BadRequestException('Failed to create user');
    }

    // 2. Username benzersiz mi kontrol et
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', registerDto.username)
      .single();

    if (existingProfile) {
      // Kullanıcı oluşturuldu ama profile oluşturulamadı, geri al
      throw new BadRequestException('Username already taken');
    }

    // 3. Profile oluştur
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      username: registerDto.username,
      display_name: registerDto.username,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${registerDto.username}`,
    });

    if (profileError) {
      throw new BadRequestException(
        'Failed to create profile: ' + profileError.message
      );
    }

    // 4. Token döndür
    return {
      message: 'Registration successful',
      access_token: authData.session?.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: registerDto.username,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get access token' })
  async login(@Body() loginDto: LoginDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
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
    try {
      // Use Supabase client directly (same as register endpoint)
      const supabase = this.supabaseService.getClient();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile query timeout')), 5000)
      );

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: profile, error } = (await Promise.race([
        profilePromise,
        timeoutPromise,
      ])) as any;

      if (error || !profile) {
        // If profile not found, return basic user info
        return {
          id: user.id,
          username: user.email?.split('@')[0] || 'user',
          email: user.email,
          avatar_url: undefined,
          display_name: user.email?.split('@')[0] || 'user',
          bio: '',
          status: 'Online',
          statusMessage: '',
        };
      }

      return {
        id: profile.id,
        username: profile.username,
        email: user.email,
        avatar_url: profile.avatar_url || undefined,
        display_name: profile.display_name || profile.username,
        bio: profile.bio || '',
        status: 'Online', // TODO: Implement online status tracking
        statusMessage: '', // TODO: Add status message field to schema if needed
      };
    } catch (error: any) {
      console.error('Error in /auth/me:', error.message || error);
      // Return basic user info on any error
      return {
        id: user.id,
        username: user.email?.split('@')[0] || 'user',
        email: user.email,
        avatar_url: undefined,
        display_name: user.email?.split('@')[0] || 'user',
        bio: '',
        status: 'Online',
        statusMessage: '',
      };
    }
  }
}

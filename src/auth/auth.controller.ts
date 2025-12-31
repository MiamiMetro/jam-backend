import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { DbService } from '../db/db.service';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private supabaseService: SupabaseService,
    private dbService: DbService
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Username benzersiz mi kontrol et (ÖNCE KONTROL ET - auth user oluşturmadan önce)
    const [existingProfile] = await this.dbService.db
      .select({ username: profiles.username })
      .from(profiles)
      .where(eq(profiles.username, registerDto.username))
      .limit(1);

    if (existingProfile) {
      return { error: 'Username already taken' };
    }

    // 2. Email ile kayıtlı kullanıcı var mı kontrol et (optional check)
    // Note: Supabase signUp will return an error if email exists, so this is just for better UX
    // We'll let signUp handle duplicate email errors

    // 3. Supabase'de kullanıcı oluştur
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        emailRedirectTo: undefined, // Disables email confirmation
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    if (!authData.user) {
      return { error: 'Failed to create user' };
    }

    // 4. Profile oluştur
    try {
      await this.dbService.db.insert(profiles).values({
        id: authData.user.id,
        username: registerDto.username,
        displayName: registerDto.display_name || registerDto.username,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${registerDto.username}`,
      });
    } catch (profileError: any) {
      // Profile oluşturulamadı, auth user'ı sil
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error(
          'Failed to delete auth user after profile creation error:',
          deleteError
        );
      }
      return { error: 'Failed to create profile: ' + profileError.message };
    }

    // 5. Token döndür
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

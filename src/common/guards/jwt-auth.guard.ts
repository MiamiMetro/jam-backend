import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      const supabase = this.supabaseService.getClient();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Token verification timeout')), 5000)
      );

      // Supabase'in kendi metoduyla token'ı doğrula
      const verificationPromise = supabase.auth.getUser(token);

      const {
        data: { user },
        error,
      } = await Promise.race([verificationPromise, timeoutPromise]) as any;

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // User bilgilerini request'e ekle
      request.user = {
        id: user.id,
        email: user.email,
      };

      return true;
    } catch (error: any) {
      console.error('JWT verification error:', error.message || error);
      if (error.message === 'Token verification timeout') {
        throw new UnauthorizedException('Token verification timeout');
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // If no token, allow the request but user will be undefined
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.user = null;
      return true;
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
      } = (await Promise.race([verificationPromise, timeoutPromise])) as any;

      if (error || !user) {
        // Invalid token, but don't throw error - just set user to null
        request.user = null;
        return true;
      }

      // User bilgilerini request'e ekle
      request.user = {
        id: user.id,
        email: user.email,
      };

      return true;
    } catch (error: any) {
      // On error, allow request but user will be null
      console.error('[OptionalJwtAuthGuard] Error:', error?.message);
      request.user = null;
      return true;
    }
  }
}

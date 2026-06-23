import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { ApiResponse, SharedHttpService } from 'voyage-lib';
import { Observable } from 'rxjs/internal/Observable';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private httpService = inject(SharedHttpService);

  currentuser: WritableSignal<User | null> = signal(null);

  setCurrentUser(user: User | null) {
    this.currentuser.set(user);
  }

  signUp(username: string, email: string, password: string): Observable<ApiResponse<{ user: User }>> {
    const body = { username, email, password };
    return this.httpService.post<ApiResponse<{ user: User }>>('/auth/signup', body);
  }

  login(email: string, password: string): Observable<ApiResponse<{ user: User }>> {
    const body = { email, password };
    return this.httpService.post<ApiResponse<{ user: User }>>('/auth/login', body);
  }

  resend(email: string): Observable<ApiResponse> {
    const body = { email };
    return this.httpService.post<ApiResponse>('/auth/resend', body);
  }

  logout(): Observable<ApiResponse> {
    return this.httpService.post<ApiResponse>('/auth/logout', {});
  }

  getCurrentUser(): Observable<ApiResponse<{ user: User }>> {
    return this.httpService.get<ApiResponse<{ user: User }>>('/auth/user');
  }

  verifyToken(token_hash: string, type: string): Observable<ApiResponse<{ user: User }>> {
    const body = { token_hash, type };
    return this.httpService.post<ApiResponse<{ user: User }>>('/auth/verify-token', body);
  }

  forgotPassword(email: string): Observable<ApiResponse> {
    return this.httpService.post<ApiResponse>('/auth/forgot-password', { email });
  }

  resetPassword(password: string): Observable<ApiResponse> {
    return this.httpService.put<ApiResponse>('/auth/reset-password', { password });
  }

  // No longer needed — session is set server-side during login and OTP verification
  setSession(accessToken: string, refreshToken: string): Observable<ApiResponse> {
    const body = { accessToken, refreshToken };
    return this.httpService.post<ApiResponse>('/auth/setsession', body);
  }

  // No longer needed — token refresh is handled server-side by auth middleware
  refreshToken(refreshToken: string): Observable<ApiResponse> {
    const body = { refresh_token: refreshToken };
    return this.httpService.post<ApiResponse>('/auth/refresh', body);
  }
}

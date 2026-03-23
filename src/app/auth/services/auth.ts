import { inject, Injectable } from '@angular/core';
import { SharedHttpService } from 'voyage-lib';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private httpService = inject(SharedHttpService);

  signUp(username: string, email: string, password: string): Observable<any> {
    const body = { username, email, password };
    return this.httpService.post('/auth/signup', body);
  }

  login(email: string, password: string) {
    const body = { email, password };
    return this.httpService.post('/auth/login', body);
  }

  resend(email: string) {
    const body = { email };
    return this.httpService.post('/auth/resend', body);
  }

  logout() {
    return this.httpService.post('/auth/logout', {});
  }

  getCurrentUser() {
    return this.httpService.get<{ username: string; email: string }>('/auth/user');
  }

  verifyOtp(token_hash: string, type: string) {
    const body = { token_hash, type };
    return this.httpService.post('/auth/verify-otp', body);
  }

  setSession(accessToken: string, refreshToken: string) {
    const body = { accessToken, refreshToken };
    return this.httpService.post('/auth/setsession', body);
  }
}

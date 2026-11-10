import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Route } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { authGuard } from '@core/guards/auth.guard';
import { joinPageResolver } from './features/join/resolvers/join-page.resolver';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/components/landing/landing').then((m) => m.LandingPage),
    data: { title: 'Track Your Travel Expenses' },
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/components/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { title: 'Dashboard' },
      },
      {
        path: 'expenses',
        loadChildren: () =>
          isPlatformServer(inject(PLATFORM_ID))
            ? []
            : loadRemoteModule('expenseModule', './Routes').then((m) => m.remoteRoutes),
        data: { title: 'Expenses' },
      },
      {
        path: 'my-journey',
        loadComponent: () => import('./features/my-journey/components/my-journey/my-journey').then((m) => m.MyJourney),
        data: { title: 'My Journey' }
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/components/account/account.component').then((m) => m.AccountComponent),
        data: { title: 'Account' },
      },
      {
        path: 'invites',
        loadComponent: () =>
          import('./features/invites/components/my-invites/my-invites.component').then((m) => m.MyInvitesComponent),
        data: { title: 'Trip Invitations' },
      },
    ],
  },
  {
    path: 'auth/signin',
    loadComponent: () =>
      import('./features/auth/components/sign-in/sign-in').then((m) => m.SignIn),
    data: { title: 'Sign In' },
  },
  {
    path: 'auth/signup',
    loadComponent: () =>
      import('./features/auth/components/sign-up/sign-up').then((m) => m.SignUp),
    data: { title: 'Sign Up' },
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/components/forgot-password/forgot-password').then(
        (m) => m.ForgotPassword,
      ),
    data: { title: 'Forgot Password' },
  },
  {
    path: 'auth/confirm-email',
    loadComponent: () =>
      import(
        './features/auth/components/confirmation-email/confirmation-email'
      ).then((m) => m.ConfirmationEmail),
    data: { title: 'Confirm Email' },
  },
  {
    path: 'auth/verify',
    loadComponent: () =>
      import('./features/auth/components/verify/verify').then((m) => m.Verify),
    data: { title: 'Verify' },
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/components/reset-password/reset-password').then((m) => m.ResetPassword),
    data: { title: 'Reset Password' },
  },
  {
    // Shareable invite link. Public (no authGuard): visitors see the invite first and sign in
    // to accept. Rendered on the server per request, see app.routes.server.ts.
    path: 'join/:token',
    loadComponent: () => import('./features/join/components/join/join').then((m) => m.JoinPage),
    resolve: { join: joinPageResolver },
    data: { title: 'Trip Invitation', noindex: true },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./not-found/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    data: { title: 'Page Not Found' },
  },
];

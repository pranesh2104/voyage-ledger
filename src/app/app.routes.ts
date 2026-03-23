import { Route } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { authGuard } from './auth/guards/auth.guard';

export const appRoutes: Route[] = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
            import('./landing/landing').then((m) => m.LandingPage),
        data: { title: 'Track Your Travel Expenses' },
    },
    {
        path: '',
        loadComponent: () =>
            import('./layout/layout.component').then((m) => m.LayoutComponent),
        canActivate: [authGuard],
        children: [
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
                data: { title: 'Dashboard' },
            },
            {
                path: 'expenses',
                loadChildren: () =>
                    loadRemoteModule('expenseModule', './Routes').then((m) => m.remoteRoutes),
                data: { title: 'Expenses' },
            },
        ],
    },
    {
        path: 'auth/signin',
        loadComponent: () =>
            import('./auth/components/sign-in/sign-in').then((m) => m.SignIn),
        data: { title: 'Sign In' },
    },
    {
        path: 'auth/signup',
        loadComponent: () =>
            import('./auth/components/sign-up/sign-up').then((m) => m.SignUp),
        data: { title: 'Sign Up' },
    },
    {
        path: 'auth/forgot-password',
        loadComponent: () =>
            import('./auth/components/forgot-password/forgot-password').then(
                (m) => m.ForgotPassword,
            ),
        data: { title: 'Forgot Password' },
    },
    {
        path: 'auth/confirm-email',
        loadComponent: () =>
            import(
                './auth/components/confirmation-email/confirmation-email'
            ).then((m) => m.ConfirmationEmail),
        data: { title: 'Confirm Email' },
    },
    {
        path: 'auth/verify',
        loadComponent: () =>
            import('./auth/components/verify/verify').then((m) => m.Verify),
        data: { title: 'Verify' },
    },
    {
        path: '**',
        loadComponent: () =>
            import('./not-found/not-found.component').then((m) => m.NotFoundComponent),
        data: { title: 'Page Not Found' },
    },
];

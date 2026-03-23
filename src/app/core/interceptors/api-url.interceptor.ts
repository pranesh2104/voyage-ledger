import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
    const baseUrl = inject(API_BASE_URL);

    if (req.url.startsWith('/')) {
        req = req.clone({
            url: `${baseUrl}${req.url}`,
        });
    }

    return next(req);
};

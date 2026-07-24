import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="not-found-container">
      <div class="content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Sorry, the page you're looking for doesn't exist.</p>
        <a routerLink="/" class="home-link">Go to Home</a>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 2rem;
    }

    .content {
      max-width: 600px;
    }

    h1 {
      font-size: 8rem;
      margin: 0;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }

    h2 {
      font-size: 2rem;
      margin: 1rem 0;
    }

    p {
      font-size: 1.2rem;
      margin: 1.5rem 0;
      opacity: 0.9;
    }

    .home-link {
      display: inline-block;
      margin-top: 2rem;
      padding: 1rem 2rem;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .home-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  `]
})
export class NotFoundComponent {}

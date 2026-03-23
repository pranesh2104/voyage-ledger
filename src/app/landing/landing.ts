import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../shared/components/theme-toggle/theme-toggle.component';

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [RouterModule, ThemeToggleComponent],
    templateUrl: './landing.html',
})
export class LandingPage { }

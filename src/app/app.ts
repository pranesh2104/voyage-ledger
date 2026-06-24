import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SnackbarComponent } from 'voyage-lib';

@Component({
  imports: [RouterModule, SnackbarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'shell';
}

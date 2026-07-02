import {
  AfterViewInit,
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  Type,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import type { DialogComponent } from 'voyage-ui/ui';
import { RemoteOutletComponent } from '../shared/components/remote-outlet/remote-outlet.component';
import { RemoteUiService } from '../shared/services/remote-ui.service';
import { TripDialogService } from '../services/trip-dialog.service';
import { TripFormComponent } from './trip-form.component';

@Component({
  selector: 'app-trip-form-dialog',
  standalone: true,
  imports: [TripFormComponent, RemoteOutletComponent],
  templateUrl: './trip-form-dialog.component.html',
})
export class TripFormDialogComponent implements AfterViewInit {
  readonly dialogService = inject(TripDialogService);
  private readonly remoteUi = inject(RemoteUiService);

  /** Incremented to signal the form to submit. */
  readonly submitCount = signal(0);
  readonly isFormValid = signal(false);
  readonly isSubmitting = signal(false);

  readonly dialogComponent = signal<Type<DialogComponent> | null>(null);
  readonly dialogContent = signal<Node[][]>([]);

  readonly dialogInputs = computed(() => ({
    isOpen: this.dialogService.isOpen(),
    title: this.dialogService.tripId() ? 'Edit Trip' : 'New Trip',
    subtitle: this.dialogService.tripId()
      ? 'Update your trip details'
      : 'Add details about your upcoming adventure',
    hasFooter: true,
  }));

  /** Stable reference: RemoteOutletComponent only wires closures present when the instance first appears. */
  readonly dialogOutputBindings = { closed: () => this.dialogService.close() };

  private readonly contentAnchor = viewChild.required('contentAnchor', { read: ViewContainerRef });
  private readonly bodyTpl = viewChild.required<TemplateRef<unknown>>('bodyTpl');
  private readonly footerTpl = viewChild.required<TemplateRef<unknown>>('footerTpl');

  ngAfterViewInit(): void {
    this.remoteUi.load().then((m) => {
      const anchor = this.contentAnchor();
      const bodyView = anchor.createEmbeddedView(this.bodyTpl());
      const footerView = anchor.createEmbeddedView(this.footerTpl());
      bodyView.detectChanges();
      footerView.detectChanges();
      // Set together so NgComponentOutlet's first creation already has the
      // correct projected content - no window where raw form markup is unwrapped in the DOM.
      this.dialogContent.set([bodyView.rootNodes, footerView.rootNodes]);
      this.dialogComponent.set(m.DialogComponent);
    });
  }

  triggerSubmit(): void {
    this.submitCount.update((n) => n + 1);
  }
}

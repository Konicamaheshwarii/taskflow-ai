import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Focuses the element once it is rendered (the native attribute does not fire for dynamic content). */
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => el.focus());
  }
}

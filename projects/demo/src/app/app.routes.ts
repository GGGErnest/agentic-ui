import { Routes } from '@angular/router';
import { CrudDemo } from './pages/crud-demo/crud-demo';

export const routes: Routes = [
  { path: '', component: CrudDemo },
  { path: '**', redirectTo: '' },
];

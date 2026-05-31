import { Routes } from '@angular/router';
import { CrudDemo } from './pages/crud-demo/crud-demo';

export const routes: Routes = [
  { path: '', redirectTo: 'tasks', pathMatch: 'full' },
  { path: 'tasks', component: CrudDemo },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/user-profile/user-profile').then((m) => m.UserProfile),
  },
  { path: '**', redirectTo: 'tasks' },
];

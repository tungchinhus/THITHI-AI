import { Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { ExcelImportComponent } from './excel-import/excel-import.component';

export const routes: Routes = [
  {
    path: '',
    component: ChatComponent
  },
  {
    path: 'chat',
    component: ChatComponent
  },
  {
    path: 'import',
    component: ExcelImportComponent
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];

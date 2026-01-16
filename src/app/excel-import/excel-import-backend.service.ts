import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpProgressEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ImportResponse {
  message: string;
  fileName: string;
  tableName: string;
  columns: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelImportBackendService {
  private apiUrl = environment.backendApiUrl || 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  /**
   * Import Excel file to .NET Backend (SQL Server)
   * @param file Excel file
   * @param tableName Table name in SQL Server
   * @param selectedColumns Array of selected column names
   * @returns Observable with import response
   */
  importExcelToBackend(
    file: File,
    tableName: string,
    selectedColumns: string[]
  ): Observable<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tableName', tableName);
    
    // Append each selected column
    selectedColumns.forEach(column => {
      formData.append('selectedColumns', column);
    });

    return this.http.post<ImportResponse>(
      `${this.apiUrl}/api/vectorimport/import`,
      formData
    );
  }

  /**
   * Check backend health
   */
  checkHealth(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(
      `${this.apiUrl}/api/vectorimport/health`
    );
  }
}

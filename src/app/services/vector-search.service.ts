import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SearchRequest {
  query: string;
  tableName?: string;
  topN?: number;
  similarityThreshold?: number;
}

export interface SearchResult {
  id: number;
  content: string;
  similarity: number;
}

export interface SearchResponse {
  query: string;
  tableName: string;
  totalResults: number;
  results: SearchResult[];
  /** True khi không kết nối được API (ví dụ Python API chưa chạy) */
  connectionError?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VectorSearchService {
  private apiUrl = (environment as any).vectorSearchApiUrl || environment.backendApiUrl || 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  /**
   * Tìm kiếm với vector similarity
   * @param query Câu hỏi cần tìm kiếm
   * @param tableName Tên bảng (mặc định: TSMay)
   * @param topN Số lượng kết quả (mặc định: 10)
   * @param similarityThreshold Ngưỡng similarity 0-1 (mặc định: 0.3)
   */
  search(
    query: string,
    tableName: string = 'TSMay',
    topN: number = 10,
    similarityThreshold: number = 0.3
  ): Observable<SearchResponse> {
    const request: SearchRequest = {
      query,
      tableName,
      topN,
      similarityThreshold
    };
    const fullUrl = `${this.apiUrl}/api/search/vector`;

    // Timeout: 10 giây, retry: 1 lần
    return this.http.post<SearchResponse>(
      fullUrl,
      request
    ).pipe(
      timeout(10000), // 10 giây timeout
      retry(1), // Retry 1 lần nếu fail
        catchError((error: HttpErrorResponse) => {
        console.error('Vector search error:', error);
        const isConnectionRefused = error.status === 0;
        const emptyResponse: SearchResponse = {
          query,
          tableName,
          totalResults: 0,
          results: [],
          connectionError: isConnectionRefused
        };
        
        if (isConnectionRefused) {
          console.warn('⚠️ Vector search: Không thể kết nối đến dịch vụ tìm kiếm (' + this.apiUrl + '). Khởi động .NET Backend: cd backend\\THIHI_AI.Backend && dotnet run');
        } else if (error.status === 500) {
          console.warn('⚠️ Vector search: Lỗi server (500). Chat sẽ tiếp tục không có vector search.');
        } else {
          console.warn(`⚠️ Vector search: Lỗi ${error.status}. Chat sẽ tiếp tục không có vector search.`);
        }
        
        return of(emptyResponse);
      })
    );
  }

  /**
   * Health check
   */
  checkHealth(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(
      `${this.apiUrl}/api/search/health`
    ).pipe(
      timeout(5000), // 5 giây timeout cho health check
      catchError((error: HttpErrorResponse) => {
        console.warn('Vector search health check failed:', error);
        return of({ status: 'unavailable', service: 'vector-search' });
      })
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}

@Injectable({
  providedIn: 'root'
})
export class VectorSearchService {
  private apiUrl = environment.backendApiUrl || 'http://localhost:5000';

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

    return this.http.post<SearchResponse>(
      `${this.apiUrl}/api/search/vector`,
      request
    );
  }

  /**
   * Health check
   */
  checkHealth(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(
      `${this.apiUrl}/api/search/health`
    );
  }
}

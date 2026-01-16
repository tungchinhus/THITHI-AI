import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VectorSearchService, SearchResult } from '../services/vector-search.service';

@Component({
  selector: 'app-vector-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vector-search.component.html',
  styleUrls: ['./vector-search.component.css']
})
export class VectorSearchComponent implements OnInit {
  query: string = '';
  tableName: string = 'TSMay';
  topN: number = 10;
  similarityThreshold: number = 0.3;
  
  results: SearchResult[] = [];
  isSearching: boolean = false;
  errorMessage: string = '';
  totalResults: number = 0;

  constructor(private searchService: VectorSearchService) {}

  ngOnInit(): void {}

  async onSearch(): Promise<void> {
    if (!this.query.trim()) {
      this.errorMessage = 'Vui lòng nhập câu hỏi';
      return;
    }

    this.isSearching = true;
    this.errorMessage = '';
    this.results = [];

    try {
      const response = await this.searchService.search(
        this.query,
        this.tableName,
        this.topN,
        this.similarityThreshold
      ).toPromise();

      if (response) {
        this.results = response.results;
        this.totalResults = response.totalResults;
      }
    } catch (error: any) {
      console.error('Lỗi khi search:', error);
      this.errorMessage = error.error?.error || error.message || 'Lỗi khi tìm kiếm';
    } finally {
      this.isSearching = false;
    }
  }

  formatSimilarity(similarity: number): string {
    return (similarity * 100).toFixed(1) + '%';
  }

  getSimilarityColor(similarity: number): string {
    if (similarity >= 0.7) return '#059669'; // Green
    if (similarity >= 0.5) return '#d97706'; // Orange
    return '#dc2626'; // Red
  }
}

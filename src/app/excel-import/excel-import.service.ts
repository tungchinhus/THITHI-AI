import { Injectable } from '@angular/core';
import { getFirebaseApp } from '../firebase.config';
import { getFirestore, collection, addDoc, doc, setDoc, Firestore } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class ExcelImportService {
  private firestore: Firestore | null = null;

  constructor() {
    this.initializeFirestore();
  }

  private initializeFirestore(): void {
    try {
      const app = getFirebaseApp();
      if (app) {
        this.firestore = getFirestore(app);
        console.log('Firestore initialized successfully');
      } else {
        console.error('Firebase App not initialized');
      }
    } catch (error) {
      console.error('Error initializing Firestore:', error);
    }
  }

  /**
   * Sanitize field name for Firestore
   * Firestore field names must:
   * - Start with a letter or underscore
   * - Contain only letters, numbers, and underscores
   * - Not contain special characters or spaces
   */
  private sanitizeFieldName(columnName: string): string {
    if (!columnName || columnName.trim() === '') {
      return 'field_unnamed';
    }

    // Chuyển đổi sang string và loại bỏ khoảng trắng đầu/cuối
    let sanitized = String(columnName).trim();

    // Thay thế các ký tự không hợp lệ bằng underscore
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '_');

    // Nếu bắt đầu bằng số, thêm prefix "col_"
    if (/^[0-9]/.test(sanitized)) {
      sanitized = 'col_' + sanitized;
    }

    // Nếu rỗng sau khi sanitize, dùng tên mặc định
    if (sanitized === '' || sanitized === '_') {
      sanitized = 'field_unnamed';
    }

    // Đảm bảo không quá dài (Firestore limit: 1500 characters, nhưng giới hạn 100 cho field name)
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
  }

  /**
   * Convert data values to Firestore-compatible types
   */
  private convertToFirestoreValue(value: any): any {
    // null và undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Date objects
    if (value instanceof Date) {
      return value;
    }

    // Numbers
    if (typeof value === 'number') {
      // Check for NaN or Infinity
      if (isNaN(value) || !isFinite(value)) {
        return null;
      }
      return value;
    }

    // Booleans
    if (typeof value === 'boolean') {
      return value;
    }

    // Strings
    if (typeof value === 'string') {
      // Empty strings can be stored, but we'll keep them as is
      return value;
    }

    // Objects and arrays - Firestore supports these
    if (typeof value === 'object') {
      // Check for circular references by trying to stringify
      try {
        JSON.stringify(value);
        return value;
      } catch (e) {
        // If circular or invalid, convert to string
        return String(value);
      }
    }

    // Fallback: convert to string
    return String(value);
  }

  /**
   * Import Excel data to Firestore
   * @param tableName Collection name (e.g., "TSMay")
   * @param data Array of row objects
   * @param columns Selected column names
   * @param progressCallback Callback for progress updates
   * @returns Array of document IDs that were created
   */
  async importExcelData(
    tableName: string,
    data: any[],
    columns: string[],
    progressCallback?: (progress: number) => void
  ): Promise<string[]> {
    if (!this.firestore) {
      throw new Error('Firestore chưa được khởi tạo');
    }

    if (!tableName || tableName.trim() === '') {
      throw new Error('Tên bảng không được để trống');
    }

    if (!data || data.length === 0) {
      throw new Error('Không có dữ liệu để import');
    }

    // Tạo mapping giữa tên cột gốc và tên field đã sanitize
    const columnMapping: { [originalName: string]: string } = {};
    columns.forEach(colName => {
      columnMapping[colName] = this.sanitizeFieldName(colName);
    });

    const totalRows = data.length;
    let importedRows = 0;
    const errors: string[] = [];
    const documentIds: string[] = [];

    try {
      // Import từng dòng vào Firestore
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Tạo document với dữ liệu từ các cột đã chọn
          // Sử dụng tên field đã sanitize cho Firestore
          const docData: any = {};
          
          // Map dữ liệu với tên field đã sanitize
          columns.forEach(originalColName => {
            const sanitizedFieldName = columnMapping[originalColName];
            const value = row[originalColName];
            docData[sanitizedFieldName] = this.convertToFirestoreValue(value);
          });

          // Thêm metadata với tên field hợp lệ
          docData._importedAt = new Date();
          docData._originalColumns = columns; // Giữ tên cột gốc
          docData._columnMapping = columnMapping; // Giữ mapping để có thể map lại
          docData._rowIndex = i + 1;

          // Thêm vào collection và lưu document ID
          const docRef = await addDoc(collection(this.firestore, tableName), docData);
          documentIds.push(docRef.id);
          
          importedRows++;
          
          // Cập nhật progress
          if (progressCallback) {
            const progress = Math.round((importedRows / totalRows) * 100);
            progressCallback(progress);
          }
        } catch (error: any) {
          console.error(`Lỗi khi import dòng ${i + 1}:`, error);
          const errorMsg = error.message || 'Lỗi không xác định';
          errors.push(`Dòng ${i + 1}: ${errorMsg}`);
          
          // Log chi tiết lỗi để debug
          if (error.message && error.message.includes('invalid data')) {
            console.error(`Chi tiết dòng ${i + 1}:`, row);
          }
          
          // Tiếp tục với dòng tiếp theo
          continue;
        }
      }

      if (errors.length > 0) {
        console.warn(`Import hoàn tất với ${errors.length} lỗi:`, errors.slice(0, 10)); // Chỉ log 10 lỗi đầu
      }

      console.log(`✅ Import thành công ${importedRows}/${totalRows} dòng vào collection "${tableName}"`);
      
      if (importedRows === 0) {
        throw new Error('Không có dòng nào được import thành công');
      }

      return documentIds;
    } catch (error: any) {
      console.error('Lỗi khi import dữ liệu:', error);
      throw new Error(`Lỗi khi import: ${error.message || 'Không thể import dữ liệu'}`);
    }
  }

  /**
   * Generate embeddings for imported documents
   * @param documentIds Array of document IDs to generate embeddings for
   * @param functionsUrl Firebase Functions URL
   * @param progressCallback Optional callback for progress updates
   */
  async generateEmbeddingsForDocuments(
    documentIds: string[],
    functionsUrl: string,
    progressCallback?: (progress: number, current: number, total: number) => void
  ): Promise<{ success: number; errors: number }> {
    if (!documentIds || documentIds.length === 0) {
      return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;
    const batchSize = 5; // Process 5 documents at a time to avoid rate limiting

    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (docId) => {
        try {
          const response = await fetch(`${functionsUrl}/generateTSMayDocumentEmbedding`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ documentId: docId })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          success++;
          if (progressCallback) {
            progressCallback(Math.round(((i + batch.length) / documentIds.length) * 100), i + batch.length, documentIds.length);
          }
        } catch (error: any) {
          errors++;
          console.error(`Error generating embedding for document ${docId}:`, error);
          if (progressCallback) {
            progressCallback(Math.round(((i + batch.length) / documentIds.length) * 100), i + batch.length, documentIds.length);
          }
        }
      }));

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < documentIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { success, errors };
  }

  /**
   * Get Firestore instance
   */
  getFirestore(): Firestore | null {
    return this.firestore;
  }
}

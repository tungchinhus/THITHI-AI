import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import * as XLSX from 'xlsx';
import { ExcelImportService } from './excel-import.service';
import { getFirebaseAuth, getFirebaseApp } from '../firebase.config';
import { onAuthStateChanged, User, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { environment } from '../../environments/environment';

interface ExcelColumn {
  name: string;
  selected: boolean;
  index: number;
}

interface ExcelRow {
  [key: string]: any;
}

@Component({
  selector: 'app-excel-import',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './excel-import.component.html',
  styleUrls: ['./excel-import.component.css']
})
export class ExcelImportComponent implements OnInit {
  selectedFile: File | null = null;
  columns: ExcelColumn[] = [];
  excelData: ExcelRow[] = [];
  tableName: string = 'TSMay';
  databaseName: string = 'THITHI_AI';
  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  previewData: ExcelRow[] = [];
  showPreview: boolean = false;
  user: User | null = null;
  isAuthenticated: boolean = false;
  isLoadingAuth: boolean = false;
  generateEmbeddings: boolean = true; // Mặc định bật generate embeddings
  embeddingProgress: number = 0;
  isGeneratingEmbeddings: boolean = false;

  constructor(private excelImportService: ExcelImportService) {}

  ngOnInit(): void {
    this.initializeAuth();
  }

  initializeAuth(): void {
    const auth = getFirebaseAuth();
    if (auth) {
      // Check for redirect result (when user comes back from redirect)
      getRedirectResult(auth).then((result) => {
        if (result) {
          console.log('User signed in via redirect:', result.user);
          this.user = result.user;
          this.isAuthenticated = !!result.user;
        }
      }).catch((error) => {
        console.error('Error getting redirect result:', error);
      });

      // Listen to auth state changes
      onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        this.user = user;
        this.isAuthenticated = !!user;
      }, (error) => {
        console.error('Auth state change error:', error);
      });
    } else {
      console.error('Firebase Auth chưa được khởi tạo');
      this.isAuthenticated = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    console.log('=== Google Sign-In Started ===');
    
    // Check Firebase config first
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      console.error('Firebase App is not initialized');
      alert('Firebase chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.');
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      alert('Firebase Auth chưa được khởi tạo. Vui lòng kiểm tra cấu hình Firebase.');
      return;
    }

    this.isLoadingAuth = true;
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      console.log('Sign-in successful via popup');
      console.log('User:', result.user);
      // User state will be updated via onAuthStateChanged
    } catch (error: any) {
      console.error('=== Error signing in with Google (popup) ===');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // If popup is blocked, try redirect instead
      if (error.code === 'auth/popup-blocked') {
        const useRedirect = confirm(
          'Popup bị chặn bởi trình duyệt.\n\n' +
          'Bạn có muốn sử dụng phương thức redirect (chuyển hướng) không?\n\n' +
          'Lưu ý: Bạn sẽ được chuyển đến trang đăng nhập của Google và quay lại sau khi đăng nhập.'
        );
        
        if (useRedirect) {
          try {
            await signInWithRedirect(auth, provider);
            return;
          } catch (redirectError: any) {
            console.error('Error with redirect sign-in:', redirectError);
            alert('Không thể chuyển hướng đến trang đăng nhập.\n\nLỗi: ' + (redirectError.message || redirectError.code));
            this.isLoadingAuth = false;
            return;
          }
        } else {
          alert('Vui lòng cho phép popup trong trình duyệt và thử lại.');
          this.isLoadingAuth = false;
          return;
        }
      }
      
      let errorMessage = 'Đăng nhập thất bại. Vui lòng thử lại.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Đăng nhập bị hủy. Vui lòng thử lại.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = '⚠️ Google Sign-In chưa được cấu hình đúng cách.\n\nVui lòng bật Google Sign-In trong Firebase Console > Authentication > Sign-in method.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google Sign-In chưa được bật trong Firebase Console.\n\nVui lòng bật Google provider trong Authentication > Sign-in method.';
      } else {
        errorMessage = `Lỗi: ${error.message || error.code}`;
      }
      
      alert(errorMessage);
    } finally {
      if (this.isLoadingAuth) {
        this.isLoadingAuth = false;
      }
    }
  }

  async logout(): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }

    try {
      await signOut(auth);
      console.log('User logged out');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Đăng xuất thất bại. Vui lòng thử lại.');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.readExcelFile(this.selectedFile);
    }
  }

  readExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Lấy sheet đầu tiên
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Chuyển đổi sang JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          alert('File Excel trống hoặc không có dữ liệu.');
          return;
        }

        // Dòng đầu tiên là header
        const headers = jsonData[0] as any[];
        
        if (!headers || headers.length === 0) {
          alert('File Excel không có header. Vui lòng kiểm tra lại file.');
          return;
        }
        
        // Xử lý tên cột: giữ nguyên tên từ Excel, nếu trùng thì thêm số tăng dần
        const processedHeaders: string[] = [];
        const headerCount: { [key: string]: number } = {};
        
        headers.forEach((header, index) => {
          // Chuyển đổi header thành string, loại bỏ undefined/null
          let headerName = header != null ? String(header).trim() : '';
          
          // Nếu header rỗng, dùng tên mặc định
          if (!headerName) {
            headerName = `Cột ${index + 1}`;
          }
          
          // Xử lý trùng tên: nếu đã có tên này, thêm số tăng dần
          if (headerCount[headerName] !== undefined) {
            headerCount[headerName]++;
            headerName = `${headerName}${headerCount[headerName]}`;
          } else {
            headerCount[headerName] = 0; // Lần đầu tiên gặp tên này
          }
          
          processedHeaders.push(headerName);
        });
        
        // Tạo danh sách cột với tên đã xử lý
        this.columns = processedHeaders
          .map((headerName, index) => {
            return {
              name: headerName,
              selected: true, // Mặc định chọn tất cả
              index: index
            };
          })
          .filter((col) => {
            // Đảm bảo column object hợp lệ
            return col != null && typeof col === 'object' && 'name' in col && 'selected' in col;
          });

        // Chuyển đổi dữ liệu thành objects với tên cột đã xử lý
        this.excelData = jsonData.slice(1).map((row: any[]) => {
          const rowObj: ExcelRow = {};
          processedHeaders.forEach((headerName, index) => {
            rowObj[headerName] = row[index] || '';
          });
          return rowObj;
        }).filter(row => {
          // Lọc bỏ các dòng trống
          return Object.values(row).some(val => val !== '' && val !== null && val !== undefined);
        });

        // Hiển thị preview 10 dòng đầu
        this.previewData = this.excelData.slice(0, 10);
        this.showPreview = true;

        console.log(`Đã đọc ${this.excelData.length} dòng dữ liệu từ ${this.columns.length} cột`);
      } catch (error) {
        console.error('Lỗi khi đọc file Excel:', error);
        alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại file.');
      }
    };
    
    reader.readAsArrayBuffer(file);
  }

  toggleColumn(column: ExcelColumn): void {
    if (!column) return;
    column.selected = !column.selected;
    // Cập nhật preview với các cột đã chọn
    this.updatePreview();
  }

  selectAllColumns(): void {
    this.columns.forEach(col => {
      if (col) col.selected = true;
    });
    this.updatePreview();
  }

  deselectAllColumns(): void {
    this.columns.forEach(col => {
      if (col) col.selected = false;
    });
    this.updatePreview();
  }

  updatePreview(): void {
    const selectedColumns = this.columns.filter(col => col && col.selected).map(col => col.name);
    this.previewData = this.excelData.slice(0, 10).map(row => {
      const filteredRow: ExcelRow = {};
      selectedColumns.forEach(colName => {
        filteredRow[colName] = row[colName];
      });
      return filteredRow;
    });
  }

  getSelectedColumns(): string[] {
    return this.columns.filter(col => col && col.selected).map(col => col.name);
  }

  async importToFirestore(): Promise<void> {
    // Kiểm tra authentication trước
    if (!this.isAuthenticated || !this.user) {
      alert('⚠️ Bạn chưa đăng nhập. Vui lòng đăng nhập để import dữ liệu.\n\nQuay lại trang Chat để đăng nhập.');
      return;
    }

    if (!this.selectedFile) {
      alert('Vui lòng chọn file Excel trước.');
      return;
    }

    const selectedColumns = this.getSelectedColumns();
    if (selectedColumns.length === 0) {
      alert('Vui lòng chọn ít nhất một cột để import.');
      return;
    }

    if (!this.tableName.trim()) {
      alert('Vui lòng nhập tên bảng.');
      return;
    }

    // Lọc dữ liệu chỉ lấy các cột đã chọn
    const filteredData = this.excelData.map(row => {
      const filteredRow: ExcelRow = {};
      selectedColumns.forEach(colName => {
        filteredRow[colName] = row[colName];
      });
      return filteredRow;
    });

    this.isUploading = true;
    this.uploadProgress = 0;
    this.uploadMessage = 'Đang import dữ liệu...';

    try {
      // Import dữ liệu vào Firestore
      const documentIds = await this.excelImportService.importExcelData(
        this.tableName,
        filteredData,
        selectedColumns,
        (progress) => {
          this.uploadProgress = progress;
        }
      );

      this.uploadMessage = `✅ Import thành công ${filteredData.length} dòng vào bảng "${this.tableName}"!`;
      this.uploadProgress = 100;

      // Generate embeddings nếu được bật và là collection TSMay
      if (this.generateEmbeddings && this.tableName === 'TSMay' && documentIds.length > 0) {
        this.isGeneratingEmbeddings = true;
        this.embeddingProgress = 0;
        this.uploadMessage += '\n\n🔄 Đang tạo embeddings để hỗ trợ tìm kiếm thông minh...';

        try {
          const functionsUrl = environment.firebaseFunctionUrl || 'https://chatfunction-7wmcfqhioa-uc.a.run.app';
          const result = await this.excelImportService.generateEmbeddingsForDocuments(
            documentIds,
            functionsUrl,
            (progress, current, total) => {
              this.embeddingProgress = progress;
              this.uploadMessage = `✅ Import thành công ${filteredData.length} dòng!\n\n🔄 Đang tạo embeddings... (${current}/${total})`;
            }
          );

          if (result.success > 0) {
            this.uploadMessage = `✅ Import thành công ${filteredData.length} dòng!\n\n✅ Đã tạo embeddings cho ${result.success} documents (${result.errors} lỗi)`;
          } else if (result.errors > 0) {
            this.uploadMessage = `✅ Import thành công ${filteredData.length} dòng!\n\n⚠️ Không thể tạo embeddings (${result.errors} lỗi). Bạn có thể tạo lại sau.`;
          }
        } catch (embeddingError: any) {
          console.error('Lỗi khi generate embeddings:', embeddingError);
          this.uploadMessage = `✅ Import thành công ${filteredData.length} dòng!\n\n⚠️ Không thể tạo embeddings: ${embeddingError.message || 'Lỗi không xác định'}. Bạn có thể tạo lại sau.`;
        } finally {
          this.isGeneratingEmbeddings = false;
          this.embeddingProgress = 0;
        }
      }

      // Reset form sau 5 giây (tăng thời gian để user thấy thông báo embeddings)
      setTimeout(() => {
        this.resetForm();
      }, 5000);
    } catch (error: any) {
      console.error('Lỗi khi import:', error);
      this.uploadMessage = `❌ Lỗi: ${error.message || 'Không thể import dữ liệu'}`;
      alert(`Lỗi khi import: ${error.message || 'Không thể import dữ liệu'}`);
    } finally {
      this.isUploading = false;
    }
  }

  resetForm(): void {
    this.selectedFile = null;
    this.columns = [];
    this.excelData = [];
    this.previewData = [];
    this.showPreview = false;
    this.uploadProgress = 0;
    this.uploadMessage = '';
    this.embeddingProgress = 0;
    this.isGeneratingEmbeddings = false;
    
    // Reset file input
    const fileInput = document.getElementById('excelFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  getSelectedColumnsCount(): number {
    return this.columns.filter(col => col && col.selected).length;
  }

  trackByColumnIndex(index: number, column: ExcelColumn): any {
    return column ? column.index : index;
  }
}

"""
Script đơn giản để download ONNX model từ Hugging Face
Sử dụng huggingface_hub để download trực tiếp
"""

import os
import sys
from pathlib import Path

# Fix encoding cho Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def main():
    print("=" * 60)
    print("Download ONNX Model từ Hugging Face")
    print("=" * 60)
    print()
    
    # Cài đặt huggingface_hub nếu chưa có
    try:
        from huggingface_hub import hf_hub_download, list_repo_files
    except ImportError:
        print("📦 Đang cài đặt huggingface_hub...")
        os.system(f"{sys.executable} -m pip install huggingface_hub --quiet")
        try:
            from huggingface_hub import hf_hub_download, list_repo_files
        except ImportError:
            print("❌ Không thể cài đặt huggingface_hub")
            return
    
    model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    output_dir = Path("C:/SQLServerModels")
    output_file = output_dir / "embedding_model.onnx"
    
    print(f"📥 Đang tìm model: {model_name}")
    print(f"📁 Output: {output_file}")
    print()
    
    # Tạo thư mục output
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ Đã tạo thư mục: {output_dir}")
    print()
    
    # Kiểm tra files trong repo
    print("🔍 Đang kiểm tra files trong repository...")
    try:
        files = list(list_repo_files(model_name))
        print(f"✅ Tìm thấy {len(files)} files trong repository")
        
        # Tìm file ONNX
        onnx_files = [f for f in files if f.endswith('.onnx')]
        if onnx_files:
            print(f"✅ Tìm thấy {len(onnx_files)} file ONNX:")
            for f in onnx_files:
                print(f"   - {f}")
            print()
            print(f"📥 Đang download: {onnx_files[0]}...")
            
            # Download file ONNX đầu tiên
            downloaded_file = hf_hub_download(
                repo_id=model_name,
                filename=onnx_files[0],
                local_dir=str(output_dir)
            )
            
            # Rename nếu cần
            downloaded_path = Path(downloaded_file)
            if downloaded_path.name != output_file.name:
                if output_file.exists():
                    output_file.unlink()
                downloaded_path.rename(output_file)
            
            print(f"✅ Đã download thành công!")
            print(f"📁 File: {output_file}")
            print(f"📊 Size: {output_file.stat().st_size / (1024*1024):.2f} MB")
            print()
            print("=" * 60)
            print("✅ HOÀN TẤT!")
            print("=" * 60)
            print()
            print("Bước tiếp theo:")
            print("1. Chạy script CREATE_ONNX_MODEL.sql trong SQL Server")
            print("2. Test với: SELECT AI_GENERATE_EMBEDDINGS('local_onnx_embeddings', NULL, 'Test')")
            print()
            
        else:
            print("⚠️  Không tìm thấy file ONNX trong repository")
            print()
            print("Các files có sẵn:")
            for f in files[:10]:  # Hiển thị 10 files đầu
                print(f"   - {f}")
            if len(files) > 10:
                print(f"   ... và {len(files) - 10} files khác")
            print()
            print("💡 Model này không có sẵn ONNX version.")
            print("   Cần convert từ PyTorch sang ONNX.")
            print("   Chạy script: download_onnx_model.py (sẽ convert tự động)")
            
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
        print()
        print("💡 Thử chạy script: download_onnx_model.py (sẽ convert từ PyTorch)")

if __name__ == "__main__":
    main()

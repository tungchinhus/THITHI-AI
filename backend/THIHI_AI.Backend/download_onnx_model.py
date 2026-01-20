"""
Script để download và convert Sentence Transformers model sang ONNX
Model: paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
"""

import os
import sys
from pathlib import Path

# Fix encoding cho Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def check_dependencies():
    """Kiểm tra và cài đặt dependencies"""
    try:
        import torch
        import transformers
        import onnxruntime
        print("✅ Dependencies đã được cài đặt")
        return True
    except ImportError:
        print("⚠️  Đang cài đặt dependencies...")
        os.system(f"{sys.executable} -m pip install torch transformers onnxruntime sentence-transformers --quiet")
        try:
            import torch
            import transformers
            import onnxruntime
            print("✅ Đã cài đặt dependencies thành công")
            return True
        except ImportError as e:
            print(f"❌ Lỗi khi cài đặt dependencies: {e}")
            return False

def download_and_convert_model():
    """Download model và convert sang ONNX"""
    try:
        from sentence_transformers import SentenceTransformer
        import torch
        
        model_name = "paraphrase-multilingual-MiniLM-L12-v2"
        output_dir = Path("C:/SQLServerModels")
        output_file = output_dir / "embedding_model.onnx"
        
        print(f"📥 Đang download model: {model_name}...")
        print("   (Lần đầu sẽ mất vài phút để download ~420MB)")
        
        # Load model
        model = SentenceTransformer(model_name)
        print(f"✅ Đã load model thành công")
        
        # Tạo thư mục output
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"✅ Đã tạo thư mục: {output_dir}")
        
        # Convert sang ONNX
        # Note: sentence-transformers không có sẵn ONNX export
        # Cần sử dụng transformers library để convert
        print("🔄 Đang convert sang ONNX...")
        print("   (Quá trình này có thể mất vài phút)")
        
        # Lấy underlying transformer model
        from transformers import AutoTokenizer, AutoModel
        
        # Get model và tokenizer từ sentence-transformers
        tokenizer = model.tokenizer
        transformer_model = model[0].auto_model
        
        # Export to ONNX
        # Tạo dummy input
        dummy_text = "This is a test sentence."
        inputs = tokenizer(dummy_text, return_tensors="pt", padding=True, truncation=True, max_length=128)
        
        # Export ONNX
        onnx_path = str(output_file)
        torch.onnx.export(
            transformer_model,
            (inputs['input_ids'], inputs['attention_mask']),
            onnx_path,
            input_names=['input_ids', 'attention_mask'],
            output_names=['embeddings'],
            dynamic_axes={
                'input_ids': {0: 'batch_size', 1: 'sequence_length'},
                'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
                'embeddings': {0: 'batch_size'}
            },
            opset_version=14,
            do_constant_folding=True
        )
        
        print(f"✅ Đã convert thành công!")
        print(f"📁 File ONNX: {output_file}")
        print(f"📊 Model dimension: 384")
        
        return True, str(output_file)
        
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def download_from_huggingface_direct():
    """Download ONNX model trực tiếp từ Hugging Face nếu có"""
    try:
        from huggingface_hub import hf_hub_download
        import shutil
        
        model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        output_dir = Path("C:/SQLServerModels")
        output_file = output_dir / "embedding_model.onnx"
        
        print("📥 Đang tìm ONNX model trên Hugging Face...")
        
        # Tạo thư mục output
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Thử download ONNX model nếu có
        try:
            # Kiểm tra xem có file .onnx trong repo không
            from huggingface_hub import list_repo_files
            files = list_repo_files(model_name)
            onnx_files = [f for f in files if f.endswith('.onnx')]
            
            if onnx_files:
                print(f"✅ Tìm thấy {len(onnx_files)} file ONNX")
                # Download file ONNX đầu tiên
                downloaded_file = hf_hub_download(
                    repo_id=model_name,
                    filename=onnx_files[0],
                    local_dir=str(output_dir),
                    local_dir_use_symlinks=False
                )
                # Rename nếu cần
                if downloaded_file != str(output_file):
                    shutil.move(downloaded_file, str(output_file))
                print(f"✅ Đã download ONNX model: {output_file}")
                return True, str(output_file)
            else:
                print("⚠️  Không tìm thấy file ONNX trong repo, sẽ convert từ PyTorch...")
                return False, None
        except Exception as e:
            print(f"⚠️  Không thể download trực tiếp: {e}")
            print("   Sẽ thử convert từ PyTorch model...")
            return False, None
            
    except ImportError:
        print("⚠️  huggingface_hub chưa được cài đặt, sẽ convert từ PyTorch...")
        return False, None
    except Exception as e:
        print(f"⚠️  Lỗi khi download từ Hugging Face: {e}")
        return False, None

def set_permissions(file_path):
    """Set permissions cho SQL Server service account"""
    try:
        import subprocess
        
        sql_service_account = "NT SERVICE\\MSSQLSERVER"
        file_dir = os.path.dirname(file_path)
        
        print(f"🔐 Đang thiết lập permissions cho SQL Server...")
        
        # Set permissions cho thư mục
        result = subprocess.run(
            ['icacls', file_dir, '/grant', f'{sql_service_account}:(OI)(CI)R', '/T'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ Đã thiết lập permissions cho {sql_service_account}")
        else:
            print(f"⚠️  Không thể thiết lập permissions tự động (có thể cần quyền Administrator)")
            print(f"   Chạy thủ công: icacls \"{file_dir}\" /grant \"{sql_service_account}:(OI)(CI)R\" /T")
            
    except Exception as e:
        print(f"⚠️  Lỗi khi thiết lập permissions: {e}")
        print(f"   Chạy thủ công: icacls \"{os.path.dirname(file_path)}\" /grant \"NT SERVICE\\MSSQLSERVER:(OI)(CI)R\" /T")

def main():
    print("=" * 60)
    print("Download và Convert ONNX Embedding Model")
    print("Model: paraphrase-multilingual-MiniLM-L12-v2")
    print("=" * 60)
    print()
    
    # Kiểm tra dependencies
    if not check_dependencies():
        print("❌ Không thể tiếp tục do thiếu dependencies")
        return
    
    print()
    
    # Thử download trực tiếp từ Hugging Face trước
    success, file_path = download_from_huggingface_direct()
    
    # Nếu không thành công, convert từ PyTorch
    if not success:
        print()
        print("🔄 Chuyển sang phương pháp convert từ PyTorch...")
        success, file_path = download_and_convert_model()
    
    if success and file_path:
        print()
        print("=" * 60)
        print("✅ HOÀN TẤT!")
        print("=" * 60)
        print(f"📁 File ONNX: {file_path}")
        print(f"📊 Dimension: 384")
        print()
        print("Bước tiếp theo:")
        print("1. Chạy script CREATE_ONNX_MODEL.sql trong SQL Server")
        print("2. Test với: SELECT AI_GENERATE_EMBEDDINGS('local_onnx_embeddings', NULL, 'Test')")
        print()
        
        # Set permissions
        set_permissions(file_path)
    else:
        print()
        print("=" * 60)
        print("❌ KHÔNG THÀNH CÔNG")
        print("=" * 60)
        print("Vui lòng thử download thủ công từ:")
        print("https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        print("và đặt vào: C:\\SQLServerModels\\embedding_model.onnx")

if __name__ == "__main__":
    main()

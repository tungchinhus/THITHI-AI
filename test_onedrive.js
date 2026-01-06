/**
 * Script test OneDrive Integration
 * Chạy trong Browser Console (F12) sau khi đăng nhập Microsoft
 */

// Test OneDrive Access
async function testOneDrive() {
  console.log('🧪 Bắt đầu test OneDrive Integration...\n');
  
  // 1. Kiểm tra token
  const token = localStorage.getItem('thihi_microsoft_token');
  const expiry = localStorage.getItem('thihi_microsoft_token_expiry');
  
  if (!token) {
    console.error('❌ Chưa đăng nhập Microsoft. Vui lòng đăng nhập trước.');
    return;
  }
  
  console.log('✅ Token Microsoft có');
  console.log('📅 Hết hạn:', expiry ? new Date(parseInt(expiry)).toLocaleString('vi-VN') : 'Không xác định');
  console.log('📏 Token length:', token.length);
  console.log('');
  
  // 2. Test User Info
  console.log('🔍 Test 1: Get User Info...');
  try {
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`HTTP ${userResponse.status}: ${await userResponse.text()}`);
    }
    
    const userInfo = await userResponse.json();
    console.log('✅ User Info OK');
    console.log('   - Name:', userInfo.displayName);
    console.log('   - Email:', userInfo.mail || userInfo.userPrincipalName);
    console.log('');
  } catch (error) {
    console.error('❌ User Info Error:', error.message);
    return;
  }
  
  // 3. Test OneDrive Recent Files
  console.log('🔍 Test 2: Get Recent Files from OneDrive...');
  try {
    const recentResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/recent', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!recentResponse.ok) {
      throw new Error(`HTTP ${recentResponse.status}: ${await recentResponse.text()}`);
    }
    
    const recentData = await recentResponse.json();
    console.log('✅ OneDrive Access OK!');
    console.log('📁 Recent files count:', recentData.value?.length || 0);
    console.log('');
    
    if (recentData.value && recentData.value.length > 0) {
      console.log('📄 Sample files (first 5):');
      recentData.value.slice(0, 5).forEach((file, index) => {
        const fileType = file.file?.mimeType || 'unknown';
        const fileSize = file.size ? formatBytes(file.size) : 'unknown';
        console.log(`   ${index + 1}. ${file.name}`);
        console.log(`      - Type: ${fileType}`);
        console.log(`      - Size: ${fileSize}`);
        console.log(`      - Modified: ${file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleString('vi-VN') : 'unknown'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ OneDrive trống hoặc không có file gần đây');
      console.log('');
    }
  } catch (error) {
    console.error('❌ OneDrive Access Error:', error.message);
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('⚠️ Không có quyền truy cập OneDrive.');
      console.error('   Vui lòng kiểm tra API permissions trong Azure AD:');
      console.error('   - Files.Read');
      console.error('   - Files.Read.All');
      console.error('   - Sites.Read.All');
    } else if (error.message.includes('401')) {
      console.error('⚠️ Token hết hạn. Vui lòng đăng nhập lại.');
    }
    return;
  }
  
  // 4. Test Root Files
  console.log('🔍 Test 3: Get Root Files from OneDrive...');
  try {
    const rootResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$top=10&$orderby=lastModifiedDateTime desc', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!rootResponse.ok) {
      throw new Error(`HTTP ${rootResponse.status}: ${await rootResponse.text()}`);
    }
    
    const rootData = await rootResponse.json();
    console.log('✅ Root Files OK!');
    console.log('📁 Root files count:', rootData.value?.length || 0);
    console.log('');
    
    if (rootData.value && rootData.value.length > 0) {
      console.log('📄 Root files (first 5):');
      rootData.value.slice(0, 5).forEach((file, index) => {
        const fileType = file.file?.mimeType || 'folder';
        console.log(`   ${index + 1}. ${file.name} (${fileType})`);
      });
      console.log('');
    }
  } catch (error) {
    console.warn('⚠️ Root Files Error:', error.message);
    console.log('');
  }
  
  // 5. Test File Types
  console.log('🔍 Test 4: Check Supported File Types...');
  const supportedTypes = {
    'Word': ['.docx', '.doc'],
    'Excel': ['.xlsx', '.xls'],
    'PDF': ['.pdf'],
    'Text': ['.txt']
  };
  
  if (recentData.value && recentData.value.length > 0) {
    const fileTypes = {};
    recentData.value.forEach(file => {
      const name = file.name || '';
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext) {
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
    });
    
    console.log('📊 File types found:');
    Object.entries(fileTypes).forEach(([ext, count]) => {
      const type = Object.entries(supportedTypes).find(([_, exts]) => exts.includes('.' + ext))?.[0] || 'Other';
      console.log(`   - ${ext.toUpperCase()}: ${count} file(s) ${type !== 'Other' ? `(${type})` : ''}`);
    });
    console.log('');
  }
  
  console.log('✅ Test hoàn tất!');
  console.log('');
  console.log('💡 Bây giờ bạn có thể test trong Chat AI:');
  console.log('   - "Tìm file trong OneDrive của tôi"');
  console.log('   - "Tóm tắt file Word trong drive"');
  console.log('   - "File Excel nào trong OneDrive?"');
}

// Helper function: Format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run test
testOneDrive();


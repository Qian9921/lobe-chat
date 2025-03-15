import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll, FirebaseStorage as FirebaseStorageType } from 'firebase/storage';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { fileEnv } from '@/config/file';
import { firebaseApp, firebaseAuth } from '@/libs/firebase';

// 判断是否在Edge Runtime环境
const isEdgeRuntime = () => {
  return typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';
};

// 检查是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

// 检查是否可以安全地使用Firebase
const canUseFirebase = !!firebaseApp && !isEdgeRuntime();

// 与S3模块使用相同的schema以保持兼容性
export const fileSchema = z.object({
  Key: z.string(),
  LastModified: z.date(),
  Size: z.number(),
});

export const listFileSchema = z.array(fileSchema);

export type FileType = z.infer<typeof fileSchema>;

// Firebase Storage适配器，实现与S3相同的接口
export class FirebaseStorage {
  private readonly storage: FirebaseStorageType | null = null;
  private readonly bucket: string;
  private readonly isAvailable: boolean;

  constructor() {
    // 检查当前环境是否支持Firebase
    if (!canUseFirebase) {
      console.log('Firebase Storage is not available in this environment');
      this.isAvailable = false;
      this.bucket = fileEnv.S3_BUCKET || 'files';
      return;
    }
    
    // 检查Firebase是否配置完成
    if (!firebaseApp) {
      console.log('Firebase app not initialized');
      this.isAvailable = false;
      this.bucket = fileEnv.S3_BUCKET || 'files';
      return;
    }

    try {
      // 初始化Firebase Storage
      this.storage = getStorage(firebaseApp);
      this.isAvailable = true;
      
      // 使用环境变量中的存储桶名称，若未设置则使用默认值
      this.bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'files';
    } catch (error) {
      console.error('Error initializing Firebase Storage:', error);
      this.isAvailable = false;
      this.bucket = fileEnv.S3_BUCKET || 'files';
    }
  }

  // 检查Firebase Storage是否可用
  private checkAvailability() {
    if (!this.isAvailable || !this.storage) {
      throw new Error('Firebase Storage is not initialized');
    }
  }

  // 获取当前用户ID，如果未登录则使用默认值
  private getCurrentUserId(): string {
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) {
      console.warn('No user is currently logged in, using default user path');
      return 'anonymous';
    }
    return currentUser.uid;
  }

  // 构建符合权限规则的文件路径
  private buildUserFilePath(key: string): string {
    const userId = this.getCurrentUserId();
    return `users/${userId}/${key}`;
  }

  // 生成预签名URL（Firebase没有预签名URL的概念，但我们可以创建下载URL）
  async createPreSignedUrl(key: string): Promise<string> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      // 生成一个符合权限规则的文件路径
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      
      // Firebase Storage没有预签名URL的概念
      // 返回文件路径，前端可以根据这个路径构建上传请求
      console.log(`Creating Firebase Storage reference for: ${filePath}`);
      
      // 为了与S3的接口保持一致，我们返回文件路径
      // 前端可以使用这个路径结合Firebase Storage SDK进行上传
      return key; // 返回原始key，保持接口一致性
    } catch (error) {
      console.error('Error creating Firebase storage reference:', error);
      throw new Error('创建上传URL失败，请检查存储配置或登录状态');
    }
  }

  // 为预览生成预签名URL
  async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      
      // Firebase不支持自定义过期时间的URL，但我们可以生成下载URL
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error creating preview URL from Firebase Storage:', error);
      throw new Error('获取预览URL失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 上传内容
  async uploadContent(path: string, content: string) {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(path);
      const storageRef = ref(this.storage, filePath);
      
      // 将字符串内容转换为Buffer
      const buffer = Buffer.from(content);
      
      // 设置metadata，包括内容类型
      const metadata = {
        contentType: 'text/plain',
      };
      
      await uploadBytes(storageRef, buffer, metadata);
      console.log(`Content uploaded successfully to: ${filePath}`);
    } catch (error) {
      console.error('Error uploading content to Firebase Storage:', error);
      throw new Error('内容上传失败，请检查存储配置或登录状态');
    }
  }

  // 获取文件内容
  async getFileContent(key: string): Promise<string> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      const url = await getDownloadURL(storageRef);
      
      // 使用fetch获取文件内容
      const response = await fetch(url);
      return await response.text();
    } catch (error) {
      console.error('Error getting file content from Firebase Storage:', error);
      throw new Error('获取文件内容失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 获取文件字节数组
  async getFileByteArray(key: string): Promise<Uint8Array> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      const url = await getDownloadURL(storageRef);
      
      // 使用fetch获取文件内容并转换为Uint8Array
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      console.error('Error getting file byte array from Firebase Storage:', error);
      throw new Error('获取文件数据失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 删除文件
  async deleteFile(key: string) {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      await deleteObject(storageRef);
      console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      console.error('Error deleting file from Firebase Storage:', error);
      throw new Error('删除文件失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 批量删除文件
  async deleteFiles(keys: string[]) {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      // Firebase Storage没有批量删除的API，我们需要逐个删除
      await Promise.all(
        keys.map(async (key) => {
          const filePath = this.buildUserFilePath(key);
          const storageRef = ref(this.storage!, filePath);
          await deleteObject(storageRef);
        })
      );
      console.log(`Deleted ${keys.length} files successfully`);
    } catch (error) {
      console.error('Error deleting multiple files from Firebase Storage:', error);
      throw new Error('批量删除文件失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 列出目录中的所有文件
  async listFiles(prefix?: string): Promise<FileType[]> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      // 确定列表的起始目录
      const userId = this.getCurrentUserId();
      const directoryPath = prefix ? `users/${userId}/${prefix}` : `users/${userId}`;
      const directoryRef = ref(this.storage, directoryPath);
      
      // 列出指定目录下所有文件
      const result = await listAll(directoryRef);
      
      // 将Firebase对象转换为FileType格式
      const fileList: FileType[] = await Promise.all(
        result.items.map(async (item) => {
          // 获取文件的元数据
          const url = await getDownloadURL(item);
          
          // 尝试获取文件大小
          let size = 0;
          try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentLength = response.headers.get('Content-Length');
            size = contentLength ? parseInt(contentLength, 10) : 0;
          } catch (error) {
            console.warn(`Could not determine size for ${item.fullPath}`);
          }
          
          // 从完整路径中提取相对路径键名
          // 例如: "users/userId/file.txt" 转换为 "file.txt"
          const keyPath = item.fullPath.split(`users/${userId}/`).pop() || item.name;
          
          return {
            Key: keyPath,
            LastModified: new Date(),
            Size: size,
          };
        })
      );
      
      return fileList;
    } catch (error) {
      console.error('Error listing files from Firebase Storage:', error);
      throw new Error('获取文件列表失败，请检查存储配置或登录状态');
    }
  }

  // 获取文件下载URL
  async getFileUrl(key: string): Promise<string> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      const filePath = this.buildUserFilePath(key);
      const storageRef = ref(this.storage, filePath);
      
      // 获取可访问的下载URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`Generated download URL for: ${key}`);
      return downloadUrl;
    } catch (error) {
      console.error('Error getting file URL from Firebase Storage:', error);
      throw new Error('获取文件URL失败，请检查文件是否存在或权限是否正确');
    }
  }

  // 上传文件
  async upload(pathname: string, file: Buffer, contentType?: string): Promise<void> {
    this.checkAvailability();
    
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not initialized');
      }
      
      // 创建文件引用，使用用户特定路径
      const filePath = this.buildUserFilePath(pathname);
      const storageRef = ref(this.storage, filePath);
      
      // 设置metadata，包括内容类型
      const metadata = {
        contentType: contentType || 'application/octet-stream',
      };
      
      // 上传文件
      await uploadBytes(storageRef, file, metadata);
      console.log(`Uploaded file successfully to: ${filePath}`);
    } catch (error) {
      console.error('Error uploading file to Firebase Storage:', error);
      throw new Error('文件上传失败，请检查存储配置或登录状态');
    }
  }

  // 生成唯一的文件名
  generateFileName(originalName: string): string {
    const extension = originalName.split('.').pop() || '';
    const uuid = uuidv4();
    return `${uuid}.${extension}`;
  }
}

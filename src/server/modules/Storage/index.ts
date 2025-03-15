import { fileEnv } from '@/config/file';
import { firebaseApp } from '@/libs/firebase';
import { FileType, S3 } from '@/server/modules/S3';
import { FirebaseStorage } from '@/server/modules/FirebaseStorage';

export interface StorageService {
  createPreSignedUrl(key: string): Promise<string>;
  createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string>;
  uploadContent(path: string, content: string): Promise<any>;
  getFileContent(key: string): Promise<string>;
  getFileByteArray(key: string): Promise<Uint8Array>;
  deleteFile(key: string): Promise<any>;
  deleteFiles(keys: string[]): Promise<any>;
  listFiles(prefix?: string): Promise<FileType[]>;
  getFileUrl(key: string): Promise<string>;
  upload(pathname: string, file: Buffer, contentType?: string): Promise<void>;
  generateFileName(originalName: string): string;
}

// 判断是否在Edge Runtime环境
const isEdgeRuntime = () => {
  return typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';
};

// 检查是否在浏览器环境
const isBrowser = typeof window !== 'undefined';

// 检查S3配置是否存在且完整
const hasValidS3Config = () => {
  return !!(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_BUCKET);
};

// 检查Firebase配置是否可用
const hasValidFirebaseConfig = () => {
  return !!firebaseApp && !isEdgeRuntime();
};

// 存储服务适配器，根据环境自动选择使用Firebase Storage或S3
export class Storage {
  private readonly storageService: S3 | FirebaseStorage;
  private readonly useS3: boolean;
  private readonly storageType: 'S3' | 'Firebase' | 'None' = 'None';

  constructor() {
    // 检查配置状态
    const hasS3Config = hasValidS3Config();
    const hasFirebaseConfig = hasValidFirebaseConfig();
    
    // 为日志创建环境摘要
    const envSummary = `[环境: ${isEdgeRuntime() ? 'Edge Runtime' : 'Node.js'}, S3配置: ${hasS3Config ? '有' : '无'}, Firebase配置: ${hasFirebaseConfig ? '有' : '无'}]`;
    
    // Edge Runtime环境特殊处理：必须使用S3
    if (isEdgeRuntime()) {
      console.log(`${envSummary} 检测到Edge Runtime环境，只能使用S3`);
      
      if (!hasS3Config) {
        throw new Error('Edge Runtime环境必须配置S3才能使用文件上传功能（Firebase不兼容）。请配置S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY和S3_BUCKET环境变量。');
      }
      
      try {
        this.storageService = new S3();
        this.useS3 = true;
        this.storageType = 'S3';
        console.log(`${envSummary} 在Edge Runtime中成功初始化S3`);
      } catch (error) {
        console.error(`${envSummary} 在Edge Runtime中S3初始化失败:`, error);
        throw new Error('在Edge Runtime中S3初始化失败。请检查S3环境变量是否正确配置。');
      }
      return;
    }
    
    // 非Edge环境下，优先使用S3，如果没有S3配置但有Firebase配置，则使用Firebase Storage
    if (hasS3Config) {
      try {
        this.storageService = new S3();
        this.useS3 = true;
        this.storageType = 'S3';
        console.log(`${envSummary} 使用S3作为存储服务`);
      } catch (error) {
        console.error(`${envSummary} S3初始化失败:`, error);
        
        if (hasFirebaseConfig) {
          console.log(`${envSummary} 尝试使用Firebase Storage作为备选`);
          try {
            this.storageService = new FirebaseStorage();
            this.useS3 = false;
            this.storageType = 'Firebase';
            console.log(`${envSummary} 成功降级到Firebase Storage`);
          } catch (fbError) {
            console.error(`${envSummary} Firebase Storage初始化也失败:`, fbError);
            throw new Error('两种存储服务(S3和Firebase)都初始化失败，请检查配置');
          }
        } else {
          throw new Error('S3配置初始化失败，且没有Firebase作为备选。请检查S3配置或添加Firebase配置。');
        }
      }
    } else if (hasFirebaseConfig) {
      try {
        this.storageService = new FirebaseStorage();
        this.useS3 = false;
        this.storageType = 'Firebase';
        console.log(`${envSummary} 使用Firebase Storage作为存储服务`);
      } catch (error) {
        console.error(`${envSummary} Firebase Storage初始化失败:`, error);
        throw new Error('Firebase Storage初始化失败，且没有S3配置可用作备选');
      }
    } else {
      throw new Error('存储配置缺失。请配置S3或Firebase至少一种存储服务。在.env.local中设置S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY和S3_BUCKET或确保Firebase配置正确。');
    }
  }

  // 获取当前使用的存储服务类型
  getStorageType(): 'S3' | 'Firebase' | 'None' {
    return this.storageType;
  }

  // 是否正在使用S3
  isUsingS3(): boolean {
    return this.useS3;
  }

  // 实现所有存储服务接口方法
  async createPreSignedUrl(key: string): Promise<string> {
    try {
      return await this.storageService.createPreSignedUrl(key);
    } catch (error) {
      console.error(`创建预签名URL失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    try {
      return await this.storageService.createPreSignedUrlForPreview(key, expiresIn);
    } catch (error) {
      console.error(`创建预览预签名URL失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async uploadContent(path: string, content: string) {
    try {
      return await this.storageService.uploadContent(path, content);
    } catch (error) {
      console.error(`上传内容失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async getFileContent(key: string): Promise<string> {
    try {
      return await this.storageService.getFileContent(key);
    } catch (error) {
      console.error(`获取文件内容失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async getFileByteArray(key: string): Promise<Uint8Array> {
    try {
      return await this.storageService.getFileByteArray(key);
    } catch (error) {
      console.error(`获取文件字节数组失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async deleteFile(key: string) {
    try {
      return await this.storageService.deleteFile(key);
    } catch (error) {
      console.error(`删除文件失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async deleteFiles(keys: string[]) {
    try {
      return await this.storageService.deleteFiles(keys);
    } catch (error) {
      console.error(`批量删除文件失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<FileType[]> {
    try {
      return await this.storageService.listFiles(prefix);
    } catch (error) {
      console.error(`列出文件失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async getFileUrl(key: string): Promise<string> {
    try {
      return await this.storageService.getFileUrl(key);
    } catch (error) {
      console.error(`获取文件URL失败(${this.storageType}):`, error);
      throw error;
    }
  }

  async upload(pathname: string, file: Buffer, contentType?: string): Promise<void> {
    try {
      return await this.storageService.upload(pathname, file, contentType);
    } catch (error) {
      console.error(`上传文件失败(${this.storageType}):`, error);
      throw error;
    }
  }

  generateFileName(originalName: string): string {
    return this.storageService.generateFileName(originalName);
  }
}

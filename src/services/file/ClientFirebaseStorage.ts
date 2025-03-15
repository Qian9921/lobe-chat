import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { nanoid } from 'nanoid';

import { firebaseApp, firebaseAuth } from '@/libs/firebase/firebase';
import { clientS3Storage } from '@/services/file/ClientS3';
import { FileMetadata } from '@/types/files';
import { FileUploadState, FileUploadStatus } from '@/types/files/upload';

/**
 * 客户端Firebase存储服务
 * 直接使用Firebase客户端SDK上传文件，绕过Edge函数的限制
 */
class ClientFirebaseStorage {
  private readonly storage: any = null;
  private readonly isAvailable: boolean;

  constructor() {
    console.log('ClientFirebaseStorage: 初始化中...');
    // 检查运行环境和Firebase初始化状态
    if (typeof window === 'undefined') {
      console.log('ClientFirebaseStorage: 非浏览器环境，无法使用Firebase客户端SDK');
      this.isAvailable = false;
      return;
    }

    if (!firebaseApp) {
      console.log('ClientFirebaseStorage: firebaseApp未初始化，无法使用Firebase存储');
      this.isAvailable = false;
      return;
    }

    try {
      console.log('ClientFirebaseStorage: 尝试获取Firebase存储实例...');
      this.storage = getStorage(firebaseApp);
      this.isAvailable = true;
      console.log('ClientFirebaseStorage: Firebase存储实例获取成功');
    } catch (error) {
      console.error('ClientFirebaseStorage: 获取Firebase存储实例失败:', error);
      this.isAvailable = false;
    }
  }

  /**
   * 检查Firebase Storage是否可用
   * @returns 是否可用
   */
  isFirebaseStorageAvailable = (): boolean => {
    const available = this.isAvailable && !!this.storage;
    console.log(`ClientFirebaseStorage: Firebase存储可用性检查结果: ${available}`);
    return available;
  };

  /**
   * 获取当前登录用户ID
   * @returns 用户ID或'anonymous'
   */
  private getCurrentUserId = (): string => {
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) {
      console.warn('ClientFirebaseStorage: 当前无用户登录，使用匿名用户路径');
      return 'anonymous';
    }
    console.log(`ClientFirebaseStorage: 当前用户ID: ${currentUser.uid}`);
    return currentUser.uid;
  };

  /**
   * 构建用户特定的文件路径
   * @param key 文件路径
   * @returns 完整的文件路径
   */
  private buildUserFilePath = (key: string): string => {
    const userId = this.getCurrentUserId();
    const path = `users/${userId}/${key}`;
    console.log(`ClientFirebaseStorage: 构建文件路径: ${path}`);
    return path;
  };

  /**
   * 上传文件到Firebase Storage
   * @param file 文件对象
   * @param options 上传选项
   * @returns 文件元数据
   */
  uploadFile = async (
    file: File,
    options: {
      directory?: string;
      onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
    } = {},
  ): Promise<FileMetadata> => {
    console.log('ClientFirebaseStorage: 开始上传文件', file.name);
    if (!this.isFirebaseStorageAvailable()) {
      const error = new Error('Firebase Storage is not available');
      console.error('ClientFirebaseStorage: Firebase存储不可用，上传失败');
      throw error;
    }

    const { directory, onProgress } = options;
    const filename = `${nanoid()}.${file.name.split('.').pop()}`;
    
    // 构建目录路径，精确到小时
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    
    const dirPath = directory 
      ? `${directory}/${year}/${month}/${day}/${hour}`
      : `uploads/${year}/${month}/${day}/${hour}`;
    
    // 最终的文件路径
    const filePath = this.buildUserFilePath(`${dirPath}/${filename}`);
    console.log(`ClientFirebaseStorage: 文件将上传到路径: ${filePath}`);
    
    // 创建存储引用
    const storageRef = ref(this.storage, filePath);
    
    // 文件元数据
    const metadata = { contentType: file.type };
    
    // 开始上传
    console.log('ClientFirebaseStorage: 开始上传过程...');
    
    return new Promise((resolve, reject) => {
      try {
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);
        
        // 监听上传进度
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // 计算进度
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const speed = snapshot.bytesTransferred / ((Date.now() - date.getTime()) / 1000);
            const restTime = (snapshot.totalBytes - snapshot.bytesTransferred) / speed;
            
            console.log(`ClientFirebaseStorage: 上传进度: ${progress.toFixed(2)}%`);
            
            // 调用进度回调
            onProgress?.('uploading', {
              progress,
              restTime,
              speed,
            });
          },
          (error) => {
            // 处理错误
            console.error('ClientFirebaseStorage: 上传失败:', error);
            onProgress?.('error', {
              progress: 0,
              restTime: 0,
              speed: 0,
            });
            reject(error);
          },
          async () => {
            // 上传完成，获取下载URL
            console.log('ClientFirebaseStorage: 上传完成，获取下载URL...');
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log(`ClientFirebaseStorage: 文件下载URL: ${downloadURL}`);
              
              // 构建文件元数据 - 按照FileMetadataSchema的规范创建
              const date = new Date().getTime().toString();
              const fileMetadata: FileMetadata = {
                date,
                dirname: dirPath,
                filename,
                path: downloadURL,
              };
              
              // 通知上传完成
              onProgress?.('success', {
                progress: 100,
                restTime: 0,
                speed: 0,
              });
              
              // 同时将文件保存到客户端存储，解决发送消息时找不到文件的问题
              try {
                // 先尝试获取文件ArrayBuffer
                const fileArrayBuffer = await file.arrayBuffer();
                // 使用一致的哈希计算方法与store层保持一致
                const { sha256 } = await import('js-sha256');
                const fileHash = sha256(fileArrayBuffer);
                
                console.log(`ClientFirebaseStorage: 文件哈希: ${fileHash}, 保存到本地IndexedDB...`);
                
                // 将文件保存到本地存储
                await clientS3Storage.putObject(fileHash, file);
                console.log('ClientFirebaseStorage: 文件已同步保存到本地存储');
                
                // 额外在控制台记录成功信息，方便排查问题
                console.log('ClientFirebaseStorage: 上传和本地存储处理完成 ✅', {
                  fileHash, 
                  fileName: file.name,
                  fileSize: file.size,
                  storagePath: filePath,
                  storedAt: new Date().toISOString()
                });
              } catch (storageError) {
                // 仅记录错误但不影响主流程
                console.error('ClientFirebaseStorage: 保存到本地存储失败:', storageError);
              }
              
              resolve(fileMetadata);
              
            } catch (urlError) {
              console.error('ClientFirebaseStorage: 获取下载URL失败:', urlError);
              reject(urlError);
            }
          }
        );
      } catch (error) {
        console.error('ClientFirebaseStorage: 初始化上传任务失败:', error);
        reject(error);
      }
    });
  };
}

// 创建Firebase存储服务实例
const createClientFirebaseStorage = () => {
  // 确保只在浏览器环境中初始化
  if (typeof window === 'undefined') {
    console.log('createClientFirebaseStorage: 非浏览器环境，返回空实现');
    // 返回一个空实现，但使用类型断言避免类型错误
    return {
      isFirebaseStorageAvailable: () => false,
      uploadFile: async () => {
        throw new Error('Firebase Storage is not available in this environment');
      },
      // 添加缺少的方法与属性
      storage: null,
      isAvailable: false,
      getCurrentUserId: () => 'anonymous',
      buildUserFilePath: (key: string) => key,
    } as unknown as ClientFirebaseStorage;
  }
  
  return new ClientFirebaseStorage();
};

export const clientFirebaseStorage = createClientFirebaseStorage();

import dayjs from 'dayjs';
import { sha256 } from 'js-sha256';

import { fileEnv } from '@/config/file';
import { isServerMode } from '@/const/version';
import { parseDataUri } from '@/libs/agent-runtime/utils/uriParser';
import { edgeClient } from '@/libs/trpc/client';
import { API_ENDPOINTS } from '@/services/_url';
import { clientFirebaseStorage } from '@/services/file/ClientFirebaseStorage';
import { clientS3Storage } from '@/services/file/ClientS3';
import { FileMetadata, UploadBase64ToS3Result } from '@/types/files';
import { FileUploadState, FileUploadStatus } from '@/types/files/upload';
import { uuid } from '@/utils/uuid';

export const UPLOAD_NETWORK_ERROR = 'NetWorkError';

interface UploadFileToS3Options {
  directory?: string;
  filename?: string;
  onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
}

class UploadService {
  /**
   * 检查Firebase存储是否可用（仅客户端）
   */
  private canUseFirebaseStorage = (): boolean => {
    return typeof window !== 'undefined' && clientFirebaseStorage.isFirebaseStorageAvailable();
  };

  /**
   * 直接使用Firebase客户端SDK上传文件
   * 这是推荐的上传方式，完全绕过服务器端API
   */
  uploadWithFirebase = async (
    file: File,
    options: UploadFileToS3Options = {},
  ): Promise<FileMetadata> => {
    console.log('UploadService: 使用Firebase客户端SDK上传文件');
    const { directory, onProgress } = options;
    
    if (!this.canUseFirebaseStorage()) {
      console.error('UploadService: Firebase客户端SDK不可用');
      throw new Error('Firebase Storage is not available in this environment');
    }
    
    try {
      return await clientFirebaseStorage.uploadFile(file, { directory, onProgress });
    } catch (error) {
      console.error('UploadService: Firebase客户端上传失败:', error);
      throw error;
    }
  };

  /**
   * 统一的上传方法，支持服务器模式和客户端模式
   * 注意：优先使用直接Firebase上传
   */
  uploadFileToS3 = async (
    file: File,
    options: UploadFileToS3Options = {},
  ): Promise<FileMetadata> => {
    const { directory, onProgress } = options;

    // 服务器模式下的处理方式
    if (isServerMode) {
      // 尝试直接使用Firebase客户端上传
      if (this.canUseFirebaseStorage()) {
        console.log('UploadService: 使用Firebase客户端SDK直接上传');
        // 不要尝试服务器端上传，直接使用客户端SDK
        try {
          return await this.uploadWithFirebase(file, options);
        } catch (error) {
          console.error('UploadService: Firebase客户端上传失败，尝试传统上传方式:', error);
        }
      }
      
      console.log('UploadService: Firebase客户端不可用，尝试传统上传');
      
      // 如果Firebase不可用或上传失败，尝试使用传统上传方法
      try {
        return await this.uploadWithProgress(file, { directory, onProgress });
      } catch (error) {
        console.error('UploadService: 传统上传也失败了:', error);
        throw error;
      }
    } else {
      // 非服务器模式（可能是开发环境）
      const fileArrayBuffer = await file.arrayBuffer();
      const hash = sha256(fileArrayBuffer);
      return this.uploadToClientS3(hash, file);
    }
  };

  uploadBase64ToS3 = async (
    base64Data: string,
    options: UploadFileToS3Options = {},
  ): Promise<UploadBase64ToS3Result> => {
    // 解析 base64 数据
    const { base64, mimeType, type } = parseDataUri(base64Data);

    if (!base64 || !mimeType || type !== 'base64') {
      throw new Error('Invalid base64 data for image');
    }

    // 将 base64 转换为 Blob
    const byteCharacters = atob(base64);
    const byteArrays = [];

    // 分块处理以避免内存问题
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);

      const byteNumbers: number[] = Array.from({ length: slice.length });
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });

    // 确定文件扩展名
    const fileExtension = mimeType.split('/')[1] || 'png';
    const fileName = `${options.filename || `image_${dayjs().format('YYYY-MM-DD-hh-mm-ss')}`}.${fileExtension}`;

    // 创建文件对象
    const file = new File([blob], fileName, { type: mimeType });

    // 优先尝试直接使用Firebase
    if (this.canUseFirebaseStorage()) {
      try {
        console.log('UploadService: 尝试使用Firebase直接上传base64数据');
        const metadata = await this.uploadWithFirebase(file, options);
        const hash = sha256(await file.arrayBuffer());
        return {
          fileType: mimeType,
          hash,
          metadata,
          size: file.size,
        };
      } catch (error) {
        console.error('UploadService: Firebase上传base64失败，尝试传统方式:', error);
      }
    }

    // 回退到传统上传方法
    console.log('UploadService: 使用传统方式上传base64数据');
    const metadata = await this.uploadFileToS3(file, options);
    const hash = sha256(await file.arrayBuffer());

    return {
      fileType: mimeType,
      hash,
      metadata,
      size: file.size,
    };
  };

  /**
   * 服务器端上传方法（使用预签名URL）
   * 注意：此方法在Edge环境中可能会失败
   */
  uploadWithProgress = async (
    file: File,
    {
      onProgress,
      directory,
    }: {
      directory?: string;
      onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
    },
  ): Promise<FileMetadata> => {
    try {
      // 最后一次检查是否可以直接使用Firebase
      if (this.canUseFirebaseStorage()) {
        console.log('UploadService: 在uploadWithProgress中重定向到Firebase客户端SDK');
        return await this.uploadWithFirebase(file, { directory, onProgress });
      }
      
      console.log('UploadService: 使用预签名URL上传');
      const xhr = new XMLHttpRequest();

      const { preSignUrl, ...result } = await this.getSignedUploadUrl(file, directory);
      let startTime = Date.now();
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Number(((event.loaded / event.total) * 100).toFixed(1));

          const speedInByte = event.loaded / ((Date.now() - startTime) / 1000);

          onProgress?.('uploading', {
            // if the progress is 100, it means the file is uploaded
            // but the server is still processing it
            // so make it as 99.9 and let users think it's still uploading
            progress: progress === 100 ? 99.9 : progress,
            restTime: (event.total - event.loaded) / speedInByte,
            speed: speedInByte,
          });
        }
      });

      xhr.open('PUT', preSignUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      const data = await file.arrayBuffer();

      await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.('success', {
              progress: 100,
              restTime: 0,
              speed: file.size / ((Date.now() - startTime) / 1000),
            });
            resolve(xhr.response);
          } else {
            reject(xhr.statusText);
          }
        });
        xhr.addEventListener('error', () => {
          if (xhr.status === 0) reject(UPLOAD_NETWORK_ERROR);
          else reject(xhr.statusText);
        });
        xhr.send(data);
      });

      return result;
    } catch (error) {
      console.error('UploadService: uploadWithProgress错误:', error);
      throw error;
    }
  };

  uploadToClientS3 = async (hash: string, file: File): Promise<FileMetadata> => {
    await clientS3Storage.putObject(hash, file);

    return {
      date: (Date.now() / 1000 / 60 / 60).toFixed(0),
      dirname: '',
      filename: file.name,
      path: `client-s3://${hash}`,
    };
  };

  /**
   * get image File item with cors image URL
   * @param url
   * @param filename
   * @param fileType
   */
  getImageFileByUrlWithCORS = async (url: string, filename: string, fileType = 'image/png') => {
    const res = await fetch(API_ENDPOINTS.proxy, { body: url, method: 'POST' });
    const data = await res.arrayBuffer();

    return new File([data], filename, { lastModified: Date.now(), type: fileType });
  };

  /**
   * 获取S3预签名URL（通过Edge函数）
   * 注意：此方法在Edge环境中可能会失败，除非配置了S3
   */
  private getSignedUploadUrl = async (
    file: File,
    directory?: string,
  ): Promise<
    FileMetadata & {
      preSignUrl: string;
    }
  > => {
    try {
      // 最后一次检查是否可以使用Firebase
      if (this.canUseFirebaseStorage()) {
        console.log('UploadService: 在getSignedUploadUrl中检测到Firebase可用，应使用直接上传');
        throw new Error('Firebase client SDK is available, should use direct upload instead');
      }
      
      console.log('UploadService: 获取预签名URL');
      const filename = `${uuid()}.${file.name.split('.').at(-1)}`;

      // 精确到以 h 为单位的 path
      const date = (Date.now() / 1000 / 60 / 60).toFixed(0);
      const dirname = `${directory || fileEnv.NEXT_PUBLIC_S3_FILE_PATH}/${date}`;
      const pathname = `${dirname}/${filename}`;

      const preSignUrl = await edgeClient.upload.createS3PreSignedUrl.mutate({ pathname });

      return {
        date,
        dirname,
        filename,
        path: pathname,
        preSignUrl,
      };
    } catch (error) {
      console.error('UploadService: 获取预签名URL失败:', error);
      throw error;
    }
  };
}

export const uploadService = new UploadService();

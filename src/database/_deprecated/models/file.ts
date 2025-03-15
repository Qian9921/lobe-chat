import { DBModel } from '@/database/_deprecated/core/types/db';
import { DB_File, DB_FileSchema } from '@/database/_deprecated/schemas/files';
import { clientS3Storage } from '@/services/file/ClientS3';
import { nanoid } from '@/utils/uuid';

import { BaseModel } from '../core';

class _FileModel extends BaseModel<'files'> {
  constructor() {
    super('files', DB_FileSchema);
  }

  async create(file: DB_File) {
    const id = nanoid();

    return this._addWithSync(file, `file-${id}`);
  }

  async findById(id: string): Promise<DBModel<DB_File> | undefined> {
    const item = await this.table.get(id);
    if (!item) return;

    // arrayBuffer to url
    let base64;
    if (!item.data) {
      const hash = (item.url as string).replace('client-s3://', '');
      base64 = await this.getBase64ByFileHash(hash);
    } else {
      base64 = Buffer.from(item.data).toString('base64');
    }

    return { ...item, base64, url: `data:${item.fileType};base64,${base64}` };
  }

  async delete(id: string) {
    return this.table.delete(id);
  }

  async clear() {
    return this.table.clear();
  }

  private async getBase64ByFileHash(hash: string) {
    try {
      console.log(`FileModel: 尝试通过哈希值获取文件 - hash:${hash}`);
      
      // 尝试从本地存储获取文件
      const fileItem = await clientS3Storage.getObject(hash);
      
      if (!fileItem) {
        console.error(`FileModel: 文件未找到 - hash:${hash}`);
        // 返回一个空图像数据，而不是抛出错误，防止UI中断
        return '';
      }
      
      // 成功获取到文件
      console.log(`FileModel: 文件获取成功 - hash:${hash}, 大小:${fileItem.size}bytes`);
      return Buffer.from(await fileItem.arrayBuffer()).toString('base64');
    } catch (error) {
      console.error(`FileModel: 获取文件失败 - hash:${hash}, 错误:`, error);
      // 返回一个空图像数据，而不是抛出错误，防止UI中断
      return '';
    }
  }
}

export const FileModel = new _FileModel();

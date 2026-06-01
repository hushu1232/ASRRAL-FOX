// 存储适配器接口
export interface StorageAdapter {
  /** 上传文件，返回 storage_path（用于存入数据库） */
  upload(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  /** 获取公网可访问的 URL */
  getFileUrl(key: string): Promise<string>;
  /** 删除文件 */
  delete(key: string): Promise<void>;
  /** 检查文件是否存在 */
  exists(key: string): Promise<boolean>;

  // 分块上传
  /** 初始化分块上传会话，返回 uploadId */
  initChunkedUpload?(finalKey: string, contentType?: string): Promise<string>;
  /** 上传单个分块 */
  uploadChunk?(uploadId: string, chunkIndex: number, buffer: Buffer): Promise<void>;
  /** 合并所有分块为最终文件，返回 storage_path */
  assembleChunks?(uploadId: string, chunks: number, finalKey: string, contentType?: string): Promise<string>;
  /** 清理分块上传会话 */
  abortChunkedUpload?(uploadId: string): Promise<void>;
  /** 获取已上传的分块索引列表（用于断点续传） */
  getUploadedChunks?(uploadId: string): Promise<number[]>;
}

export interface UploadResult {
  storagePath: string;
  fileUrl: string;
  fileSize: number;
}

export interface ChunkedUploadSession {
  uploadId: string;
  finalKey: string;
  totalChunks: number;
  chunkSize: number;
  fileSize: number;
  uploadedChunks: number[];
  contentType: string;
  status: 'uploading' | 'assembling' | 'completed' | 'aborted';
  createdAt: number;
}

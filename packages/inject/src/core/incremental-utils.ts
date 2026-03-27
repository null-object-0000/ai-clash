/**
 * 全量转增量辅助工具
 *
 * 用于处理某些 API（如通义千问）每次返回完整内容，需要自行提取增量的场景。
 * 支持多个独立的流（如思考内容、正式内容分别追踪）。
 */

/** 流状态接口 */
export interface StreamState {
  /** 上一次接收到的完整内容 */
  lastFull: string;
  /** 已发送的增量块数量 */
  chunkCount: number;
  /** 是否已完成 */
  completed: boolean;
}

/** 增量结果接口 */
export interface IncrementalResult {
  /** 增量文本 */
  delta: string;
  /** 是否是思考内容 */
  isThink: boolean;
  /** 是否已完成 */
  done: boolean;
}

/**
 * 全量转增量辅助类
 */
export class IncrementalHelper {
  private streams: Map<string, StreamState> = new Map();

  /**
   * 获取或创建流状态
   * @param streamKey - 流标识（如 'thinking', 'content'）
   */
  private getStream(streamKey: string): StreamState {
    if (!this.streams.has(streamKey)) {
      this.streams.set(streamKey, {
        lastFull: '',
        chunkCount: 0,
        completed: false,
      });
    }
    return this.streams.get(streamKey)!;
  }

  /**
   * 重置所有流状态
   */
  reset(): void {
    this.streams.clear();
  }

  /**
   * 重置指定流状态
   * @param streamKey - 流标识
   */
  resetStream(streamKey: string): void {
    this.streams.delete(streamKey);
  }

  /**
   * 处理全量内容，返回增量结果
   *
   * @param streamKey - 流标识
   * @param fullContent - 当前全量内容
   * @param isDone - 是否已结束
   * @param isThink - 是否是思考内容
   * @returns 增量结果，无增量时返回 null
   *
   * @example
   * // 千问单流场景
   * const result = helper.process('content', fullText, isDone, false);
   *
   * @example
   * // 千问双流场景（思考 + 正文）
   * const thinkResult = helper.process('thinking', thinkContent, thinkingDone, true);
   * const contentResult = helper.process('content', contentStr, contentDone, false);
   */
  process(
    streamKey: string,
    fullContent: string,
    isDone: boolean = false,
    isThink: boolean = false
  ): IncrementalResult | null {
    if (!fullContent) {
      if (isDone) {
        const stream = this.getStream(streamKey);
        if (!stream.completed) {
          stream.completed = true;
          return { delta: '', isThink, done: true };
        }
      }
      return null;
    }

    const stream = this.getStream(streamKey);

    // 检查是否有增量
    if (fullContent.length > stream.lastFull.length) {
      const delta = fullContent.substring(stream.lastFull.length);
      stream.lastFull = fullContent;
      stream.chunkCount++;
      return {
        delta,
        isThink,
        done: false,
      };
    }

    // 内容长度未变，检查是否结束标记
    if (isDone && !stream.completed) {
      stream.completed = true;
      return {
        delta: '',
        isThink,
        done: true,
      };
    }

    return null;
  }

  /**
   * 便捷方法：处理单流场景（默认 streamKey='content'）
   *
   * @param fullContent - 当前全量内容
   * @param isDone - 是否已结束
   * @param isThink - 是否是思考内容
   * @returns 增量结果，无增量时返回 null
   */
  processSingle(fullContent: string, isDone: boolean = false, isThink: boolean = false): IncrementalResult | null {
    return this.process('content', fullContent, isDone, isThink);
  }

  /**
   * 获取流状态统计
   * @param streamKey - 流标识，默认为 'content'
   */
  getStats(streamKey: string = 'content'): StreamState | null {
    return this.streams.get(streamKey) || null;
  }

  /**
   * 获取所有流的状态
   */
  getAllStats(): Map<string, StreamState> {
    return new Map(this.streams);
  }
}

/**
 * 简化的全量转增量函数（适用于简单场景，不需要类的状态管理）
 *
 * @param lastFull - 上一次的全量内容
 * @param currentFull - 当前全量内容
 * @returns [增量内容，更新后的 lastFull]，无增量时返回 ['', lastFull]
 *
 * @example
 * let lastFull = '';
 * // 每次收到全量内容时调用
 * const [delta, newLastFull] = extractIncrement(lastFull, currentFull);
 * if (delta) {
 *   console.log('增量:', delta);
 *   lastFull = newLastFull;
 * }
 */
export function extractIncrement(lastFull: string, currentFull: string): [string, string] {
  if (currentFull.length > lastFull.length) {
    const delta = currentFull.substring(lastFull.length);
    return [delta, currentFull];
  }
  return ['', lastFull];
}

import wasmURL from "@ffmpeg/core/wasm?url";
import coreURL from "@ffmpeg/core?url";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { useEffect, useRef, useState } from "react";

export const useLoadFFmpeg = (options?: Options) => {
  const { autoLoad = true, onLog, onProgress } = options || {};

  const ffmpegRef = useRef(new FFmpeg());
  const [loading, setLoading] = useState(false);

  const loadFFmpeg = async () => {
    setLoading(true);
    console.log("正在加载 FFmpeg");
    try {
      const ffmpeg = ffmpegRef.current;

      // 设置日志回调
      ffmpeg.on("log", params => {
        console.log("log", params);
        onLog?.(params.message);
      });

      // 设置进度回调
      ffmpeg.on("progress", ({ progress }) => {
        const percent = (progress * 100).toFixed(2);
        console.log(`处理进度: ${percent}%`);
        onProgress?.(progress);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(coreURL, "text/javascript"),
        wasmURL: await toBlobURL(wasmURL, "application/wasm"),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad) {
      loadFFmpeg();
    }
  }, [autoLoad]);

  return {
    loadFFmpeg,
    loading,
    ffmpegRef,
  };
};

interface Options {
  /** 自动加载 FFmpeg，默认 true */
  autoLoad?: boolean;
  /** 设置日志回调 */
  onLog?: (message: string) => void;
  /** 加载进度回调 */
  onProgress?: (progress: number) => void;
}

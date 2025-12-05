import { fetchFile } from "@ffmpeg/util";
import { useRef, useState } from "react";
import "./App.css";
import { useLoadFFmpeg } from "./hooks/useLoadFfmpeg";

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { loading: ffmpegLoading, ffmpegRef } = useLoadFFmpeg();
  /**
   * 处理文件选择
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setOutputUrl(null);
      setMessage("文件已选择，可以开始处理");
    }
  };

  /**
   * 提取视频中的音频
   */
  const handleExtractAudio = async () => {
    if (!videoFile || ffmpegLoading) {
      setMessage("请先选择文件并加载 FFmpeg");
      return;
    }

    const ffmpeg = ffmpegRef.current;
    setLoading(true);
    setMessage("正在提取音频...");

    try {
      // 使用 fetchFile 将文件转换为 Uint8Array
      await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

      // 执行 FFmpeg 命令：提取音频并转换为 MP3
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vn", // 不包含视频
        "-acodec",
        "libmp3lame", // 使用 MP3 编码器
        "-ab",
        "192k", // 音频比特率
        "output.mp3",
      ]);

      // 读取输出文件
      const data = await ffmpeg.readFile("output.mp3");

      // 创建下载链接（处理 FileData 类型：可能是 string 或 Uint8Array）
      let uint8Array: Uint8Array;
      if (typeof data === "string") {
        // 如果是字符串，转换为 Uint8Array
        uint8Array = new TextEncoder().encode(data);
      } else {
        // 如果是 Uint8Array，创建新的数组以避免类型问题
        uint8Array = new Uint8Array([...data]);
      }
      const blob = new Blob([uint8Array as BlobPart], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      console.log("url", url);
      setOutputUrl(url);
      setMessage("音频提取成功！");

      // 清理临时文件
      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp3");
    } catch (error) {
      console.error("提取音频失败:", error);
      setMessage("提取音频失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 转换视频格式（例如转换为 GIF）
   */
  const handleConvertToGif = async () => {
    if (!videoFile || ffmpegLoading) {
      setMessage("请先选择文件并加载 FFmpeg");
      return;
    }

    const ffmpeg = ffmpegRef.current;
    setLoading(true);
    setMessage("正在转换为 GIF...");

    try {
      // 使用 fetchFile 将文件转换为 Uint8Array
      await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

      // 转换为 GIF（前 5 秒，降低分辨率以提高性能）
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-t",
        "5.0", // 只转换前 5 秒
        "-ss",
        "0.0",
        "-vf",
        "fps=10,scale=320:-1", // 10fps，宽度 320px
        "output.gif",
      ]);

      const data = await ffmpeg.readFile("output.gif");
      // 处理 FileData 类型：可能是 string 或 Uint8Array
      let uint8Array: Uint8Array;
      if (typeof data === "string") {
        // 如果是字符串，转换为 Uint8Array
        uint8Array = new TextEncoder().encode(data);
      } else {
        // 如果是 Uint8Array，创建新的数组以避免类型问题
        uint8Array = new Uint8Array([...data]);
      }
      const blob = new Blob([uint8Array as BlobPart], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setMessage("GIF 转换成功！");

      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.gif");
    } catch (error) {
      console.error("转换失败:", error);
      setMessage("转换失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下载处理后的文件
   */
  const handleDownload = () => {
    if (outputUrl) {
      const a = document.createElement("a");
      a.href = outputUrl;
      a.download = outputUrl.includes(".mp3") ? "output.mp3" : "output.gif";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setMessage("文件已下载");
    }
  };

  return (
    <div className="app">
      <h1>FFmpeg.wasm 示例</h1>

      <div className="card">
        <div className="loaded-status">{!ffmpegLoading ? "✓ FFmpeg 已加载" : "... 加载中"}</div>
      </div>

      {!ffmpegLoading && (
        <div className="card">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="video-input"
              accept="video/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            <label
              htmlFor="video-input"
              className="file-label"
            >
              选择视频文件
            </label>
          </div>

          {videoFile && (
            <div className="video-preview">
              <video
                ref={videoRef}
                src={URL.createObjectURL(videoFile)}
                controls
                style={{ maxWidth: "100%", maxHeight: "300px" }}
              />
              <p className="file-name">{videoFile.name}</p>
            </div>
          )}

          <div className="actions">
            <button
              onClick={handleExtractAudio}
              disabled={!videoFile || loading}
            >
              {loading ? "处理中..." : "提取音频 (MP3)"}
            </button>
            <button
              onClick={handleConvertToGif}
              disabled={!videoFile || loading}
            >
              {loading ? "处理中..." : "转换为 GIF"}
            </button>
          </div>

          {outputUrl && (
            <div className="output">
              {outputUrl.includes(".mp3") ? (
                <audio
                  controls
                  src={outputUrl}
                  style={{ width: "100%" }}
                />
              ) : (
                <img
                  src={outputUrl}
                  alt="输出结果"
                  style={{ maxWidth: "100%" }}
                />
              )}
              <button
                onClick={handleDownload}
                className="download-btn"
              >
                下载文件
              </button>
            </div>
          )}
        </div>
      )}

      {message && <div className={`message ${loading ? "loading" : ""}`}>{message}</div>}
    </div>
  );
}

export default App;


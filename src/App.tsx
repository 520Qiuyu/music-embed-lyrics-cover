import { fetchFile } from "@ffmpeg/util";
import { useRef, useState } from "react";
import "./App.css";
import { useLoadFFmpeg } from "./hooks/useLoadFFmpeg";

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState(`[00:00.00]示例歌词第一句
[00:05.00]示例歌词第二句
[00:10.00]示例歌词第三句
[00:15.00]示例歌词第四句`);
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
   * 提取视频中的音频（自动提取第一帧作为封面，支持LRC格式同步歌词）
   */
  const handleExtractAudio = async () => {
    if (!videoFile || ffmpegLoading) {
      setMessage("请先选择文件并加载 FFmpeg");
      return;
    }

    const ffmpeg = ffmpegRef.current;
    setLoading(true);
    setMessage("正在提取视频第一帧作为封面...");

    try {
      // 写入视频文件
      await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

      // 第一步：提取视频第一帧作为封面
      setMessage("正在提取视频第一帧...");
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-ss",
        "0",
        "-vframes",
        "1",
        "-vf",
        "scale=500:-1", // 限制封面尺寸，避免过大
        "cover.jpg",
      ]);

      // 第二步：提取音频并嵌入封面和歌词
      setMessage("正在生成 MP3 文件（嵌入封面和歌词）...");
      
      // 构建 FFmpeg 命令
      const args: string[] = [
        "-i",
        "input.mp4", // 视频输入
        "-i",
        "cover.jpg", // 封面图片输入
        "-map",
        "0:a", // 映射音频
        "-map",
        "1", // 映射封面
        "-c:a",
        "libmp3lame", // 音频编码器
        "-ab",
        "192k", // 音频比特率
        "-c:v:1",
        "mjpeg", // 封面编码格式
        "-disposition:v:1",
        "attached_pic", // 设置为附加图片
        "-id3v2_version",
        "3", // ID3v2.3 格式
      ];

      // 添加LRC格式的同步歌词（如果有）
      if (lyrics.trim()) {
        // 将LRC格式歌词作为元数据嵌入
        // 注意：标准MP3格式可能不完全支持LRC时间戳的同步显示，但会作为文本元数据保存
        const lrcContent = lyrics.trim();
        // 转义特殊字符，保留换行符
        const escapedLyrics = lrcContent.replace(/"/g, '\\"').replace(/\n/g, "\\n");
        args.push("-metadata", `LYRICS=${escapedLyrics}`);
        args.push("-metadata", `USLT=${escapedLyrics}`);
      }

      // 输出文件
      args.push("output.mp3");

      // 执行 FFmpeg 命令
      await ffmpeg.exec(args);

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
      setOutputUrl(url);
      setMessage("音频提取成功！已嵌入封面和歌词");

      // 清理临时文件
      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp3");
      await ffmpeg.deleteFile("cover.jpg");
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

          {/* 歌词输入（LRC格式） */}
          <div className="lyrics-input-wrapper" style={{ marginTop: "1rem" }}>
            <label htmlFor="lyrics-input" style={{ display: "block", marginBottom: "0.5rem" }}>
              同步歌词（LRC格式，可选）：
            </label>
            <textarea
              id="lyrics-input"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="[00:00.00]第一句歌词&#10;[00:05.00]第二句歌词&#10;[00:10.00]第三句歌词"
              disabled={loading}
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #444",
                backgroundColor: "#1a1a1a",
                color: "#fff",
                resize: "vertical",
                fontFamily: "monospace",
                fontSize: "0.9rem",
              }}
            />
            <p style={{ fontSize: "0.85rem", color: "#888", marginTop: "0.5rem" }}>
              格式：[分:秒.毫秒]歌词内容（会自动提取视频第一帧作为封面）
            </p>
          </div>

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


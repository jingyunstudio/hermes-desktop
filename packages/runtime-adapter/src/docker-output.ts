/**
 * 清理 Docker 输出中的 ANSI 转义码和控制字符
 */
export function cleanDockerOutput(text: string): string {
  if (!text) {
    return text;
  }

  // 移除 ANSI 转义码
  let cleaned = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

  // 移除回车符（\r），但保留换行符（\n）
  cleaned = cleaned.replace(/\r/g, "");

  return cleaned;
}

/**
 * 解析 Docker pull 的进度行
 * 例如: "a1b2c3d4e5f6: Downloading [==>  ] 5.2MB/156MB"
 */
export function parseDockerProgress(line: string): { layer?: string; status?: string; progress?: string } | null {
  if (!line) {
    return null;
  }

  // 匹配格式: "layer_id: Status [progress] size"
  const match = line.match(/^([a-f0-9]+):\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, layer, rest] = match;
  const statusMatch = rest.match(/^([^[]+)(?:\s+\[([^\]]+)\])?(?:\s+(.+))?$/);

  if (!statusMatch) {
    return { layer, status: rest.trim() };
  }

  const [, status, progress, size] = statusMatch;
  return {
    layer,
    status: status.trim(),
    progress: progress ? `[${progress}] ${size || ""}`.trim() : size?.trim(),
  };
}

/**
 * 脱敏镜像地址
 * 隐藏私有仓库地址，但保留公共镜像源信息
 */
export function maskImageUrl(imageUrl: string): string {
  if (!imageUrl) {
    return imageUrl;
  }

  // 公共镜像源白名单 - 这些不需要脱敏
  const publicRegistries = [
    "docker.io",
    "ghcr.io",
    "registry.cn-hangzhou.aliyuncs.com",
    "ccr.ccs.tencentyun.com",
    "docker.m.daocloud.io",
    "docker.nju.edu.cn",
    "docker.mirrors.sjtug.sjtu.edu.cn",
    "docker.mirrors.ustc.edu.cn",
    "hub-mirror.c.163.com",
    "mirror.baidubce.com",
    "swr.cn-north-4.myhuaweicloud.com",
  ];

  // 检查是否是公共镜像源
  const isPublic = publicRegistries.some((registry) => imageUrl.includes(registry));
  if (isPublic) {
    return imageUrl;
  }

  // 私有镜像源脱敏处理
  // 例如: crpi-xxx.cn-chengdu.personal.cr.aliyuncs.com/namespace/image:tag
  // 变成: [私有镜像源]/namespace/image:tag

  const parts = imageUrl.split("/");
  if (parts.length >= 3) {
    // 保留命名空间和镜像名
    const namespace = parts[parts.length - 2];
    const imageWithTag = parts[parts.length - 1];
    return `[私有镜像源]/${namespace}/${imageWithTag}`;
  }

  // 如果格式不符合预期，完全脱敏
  return "[私有镜像源]";
}

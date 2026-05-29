# 使用 Bun 官方镜像作为基础
FROM oven/bun:1.1.0 as builder

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY package.json bun.lock ./

# 安装依赖
RUN bun install --production

# 复制源代码
COPY src ./src

# 构建阶段结束，使用轻量级镜像
FROM oven/bun:1.1.0-slim

# 设置工作目录
WORKDIR /app

# 从构建阶段复制依赖和源代码
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json

# 暴露端口（默认端口）
EXPOSE 8080

# 设置环境变量（默认值）
ENV DOWNSTASH_MYSQL_HOST=localhost
ENV DOWNSTASH_MYSQL_PORT=3306
ENV DOWNSTASH_MYSQL_USER=root
ENV DOWNSTASH_MYSQL_PASSWORD=
ENV DOWNSTASH_MYSQL_DATABASE=downstash
ENV DOWNSTASH_PORT=8080
ENV DOWNSTASH_TICK_MS=250
ENV DOWNSTASH_REDIS_TOKEN=dev
ENV DOWNSTASH_LOG_LEVEL=info

# 运行命令
CMD ["bun", "run", "src/cli.ts"]
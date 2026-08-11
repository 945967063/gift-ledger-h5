import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import compression from 'vite-plugin-compression';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from 'unplugin-vue-components/resolvers';
import legacy from '@vitejs/plugin-legacy';
const Timestamp = new Date().getTime();
// https://vite.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [VantResolver()],
    }),
    // Gzip 压缩插件
    compression({
      ext: '.gz', // 输出的扩展名
      threshold: 10240, // 只有大于 10KB 的文件才压缩
      algorithm: 'gzip', // 使用 gzip
      deleteOriginFile: false, // 是否删除原始文件（建议保留）
    }),
    legacy({ targets: ['> 1%', 'last 2 versions', 'not dead', 'Chrome >= 80', 'not ie 11'] }),
  ],
  //配置路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    minify: 'terser', // 使用 terser 进行压缩
    terserOptions: {
      compress: {
        drop_console: true, // 移除所有 console.*
        drop_debugger: true, // 移除所有 debugger
        pure_funcs: ['console.log'], // 指定移除函数
      },
    },
    rollupOptions: {
      // input: "index.html",
      output: {
        // 静态资源打包做处理
        chunkFileNames: `js/[name].${Timestamp}.js`,
        entryFileNames: `js/[name].${Timestamp}.js`,
        assetFileNames: `[ext]/[name].${Timestamp}.[ext]`,
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        },
      },
    },
  },
  server: {
    port: 9527,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

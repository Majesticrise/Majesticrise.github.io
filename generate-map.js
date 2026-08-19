const fs = require('fs');
const path = require('path');

// 读取 _resourceparts 下的所有 .md 文件，生成 Base64(code) -> html_filename 的映射
const RESOURCE_DIR = path.join(__dirname, '_resourceparts');
const OUT_PATH = path.join(__dirname, 'assets', 'resource-map.json');  // 注意去掉了 '..'

function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function main() {
  if (!fs.existsSync(RESOURCE_DIR)) {
    console.error('_resourceparts 目录不存在，请先创建。');
    process.exit(1);
  }
  const files = fs.readdirSync(RESOURCE_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.warn('_resourceparts 目录下没有 .md 文件，生成空映射表。');
  }
  const map = {};
  files.forEach(f => {
    const full = path.join(RESOURCE_DIR, f);
    const content = fs.readFileSync(full, 'utf8');
    // 从 front-matter 中提取 pickup_code: "..."
    const m = content.match(/pickup_code:\s*"([^"]+)"/);
    if (m) {
      const code = m[1].trim();
      const outName = f.replace(/\.md$/, '.html');
      map[base64Encode(code)] = outName;
    } else {
      console.warn(`文件 ${f} 缺少 pickup_code 字段，已跳过。`);
    }
  });
  // 确保 assets 目录存在
  const assetsDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2), 'utf8');
  console.log(`✅ 已生成映射表: ${OUT_PATH}`);
  console.log(`📦 包含 ${Object.keys(map).length} 个取件码条目。`);
}

main();
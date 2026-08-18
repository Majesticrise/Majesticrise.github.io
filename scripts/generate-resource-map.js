const fs = require('fs');
const path = require('path');

// 读取 _resourceparts 下的所有 .md 文件，生成 Base64(code) -> html_filename 的映射
const RESOURCE_DIR = path.join(__dirname, '..', '_resourceparts');
const OUT_PATH = path.join(__dirname, '..', 'assets', 'resource-map.json');

function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function main() {
  if (!fs.existsSync(RESOURCE_DIR)) {
    console.error('_resourceparts 目录不存在');
    process.exit(1);
  }
  const files = fs.readdirSync(RESOURCE_DIR).filter(f => f.endsWith('.md'));
  const map = {};
  files.forEach(f => {
    const full = path.join(RESOURCE_DIR, f);
    const content = fs.readFileSync(full, 'utf8');
    // 从 front-matter 中提取 pickup_code: "..."
    const m = content.match(/pickup_code:\s*"([^"]+)"/);
    if (m) {
      const code = m[1].trim();
      // 生成对应的输出 html 文件名（Jekyll 会把 collection 输出到 /resourceparts/filename.html）
      const outName = f.replace(/\.md$/, '.html');
      map[base64Encode(code)] = outName;
    }
  });
  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2), 'utf8');
  console.log('写入', OUT_PATH);
}

main();

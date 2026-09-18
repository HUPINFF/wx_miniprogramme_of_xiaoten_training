const fs = require('fs');
const path = require('path');

/**
 * 校验 miniprogram/ 下每个相对路径 require 都能解析到真实文件
 *
 * 为什么需要这个：`node --check` 只验语法，不解析模块路径；而小程序里路径写错
 * 不会在构建时报警，是运行到那个页面才抛 `can not find module`。
 * 层级少写一层（pages/coach/workbench 是三级不是四级）就会整个页面打不开，
 * 却不影响任何单测。这里把校验固化下来，`npm test` 就能拦住。
 */

const SRC = path.join(__dirname, '..', 'miniprogram');
const SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm']);

function collectJsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) collectJsFiles(full, out);
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function findRelativeRequires(src) {
  const re = /require\(\s*['"](\.[^'"]*)['"]\s*\)/g;
  const found = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    found.push({
      spec: m[1],
      line: src.slice(0, m.index).split('\n').length
    });
  }
  return found;
}

describe('require 路径', () => {
  const files = collectJsFiles(SRC);

  test('至少扫到了源文件（防止目录结构变动后这个测试变成空跑）', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test('每个相对 require 都指向真实存在的模块', () => {
    const broken = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const { spec, line } of findRelativeRequires(src)) {
        const base = path.resolve(path.dirname(file), spec);
        const candidates = [base, base + '.js', path.join(base, 'index.js')];
        const hit = candidates.some(c => fs.existsSync(c) && fs.statSync(c).isFile());

        if (!hit) {
          broken.push(
            `${path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/')}:${line} ` +
            `require('${spec}') → 解析到 ${path.relative(path.join(__dirname, '..'), base).replace(/\\/g, '/')}，不存在`
          );
        }
      }
    }

    expect(broken).toEqual([]);
  });
});

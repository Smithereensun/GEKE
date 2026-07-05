import { features, metrics, product, proofPoints } from "./data.js";
import { pageShell, releaseCards } from "./shared.js";

const app = document.querySelector("#app");

app.innerHTML = pageShell(
  `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Mac App Preview</p>
        <h1>${product.nameCn}<br />${product.nameEn}</h1>
        <p class="lead">${product.tagline}</p>
        <p class="lead">${product.subtitle}</p>
        <div class="hero-actions">
          <a class="button primary" href="/prototype/">查看原型图</a>
          <a class="button secondary" href="/changelog/">查看更新日志</a>
          <a class="button secondary" href="https://github.com" target="_blank" rel="noreferrer">GitHub 发布占位</a>
        </div>
        <div class="hero-notes">
          <div class="hero-note">
            <span class="note-index">01</span>
            <div>
              <strong>先做能看的测试版</strong>
              <p class="muted">这不是空白品牌页，而是可运行、可构建、可继续叠代的多页静态站版本。</p>
            </div>
          </div>
          <div class="hero-note">
            <span class="note-index">02</span>
            <div>
              <strong>用真实功能语言说服人</strong>
              <p class="muted">重点围绕启动器、截图标注、剪贴板、翻译与钉图，不做泛泛效率套话。</p>
            </div>
          </div>
        </div>
      </div>
      <div class="hero-demo" aria-label="GEKE 工作台演示">
        <div class="demo-header">
          <div class="window-dots"><span aria-hidden="true"></span></div>
          <div>GEKE Workspace Preview</div>
          <div>test build</div>
        </div>
        <div class="demo-canvas">
          <section class="command-palette">
            <div class="palette-input">
              <strong>⌘K</strong>
              <span>搜索动作、应用、历史片段与翻译…</span>
            </div>
            <div class="palette-list">
              <article class="palette-item">
                <div class="palette-key">A</div>
                <div>
                  <strong>截图并标注</strong>
                  <span>回到最近选区，继续上次结构化标注</span>
                </div>
                <div class="palette-key">Ctrl A</div>
              </article>
              <article class="palette-item">
                <div class="palette-key">W</div>
                <div>
                  <strong>打开微信</strong>
                  <span>应用启动器入口示例</span>
                </div>
                <div class="palette-key">Ctrl W</div>
              </article>
              <article class="palette-item">
                <div class="palette-key">R</div>
                <div>
                  <strong>OCR / 翻译工作台</strong>
                  <span>识字、翻译、复制与双向编辑</span>
                </div>
                <div class="palette-key">Ctrl U</div>
              </article>
            </div>
          </section>
          <aside class="capture-panel">
            <span class="capture-tag">Capture Flow</span>
            <div class="capture-list">
              <div><span>备注 / 步骤 / 箭头</span><strong>一键标注</strong></div>
              <div><span>主题色切换</span><strong>Option</strong></div>
              <div><span>最近选区回放</span><strong>5 次</strong></div>
              <div><span>OCR / 翻译 / 钉图</span><strong>同一面板</strong></div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <p class="eyebrow">Core Metrics</p>
        <h2>先把高频动作做短，再谈更多功能。</h2>
        <p>桌面素材里反复出现的核心诉求很一致：少点一步、少切一次、少找一圈。这个测试版围绕这些点组织信息。</p>
      </div>
      <div class="metric-grid">
        ${metrics
          .map(
            (item) => `
              <article class="metric-card">
                <strong>${item.value}</strong>
                <span>${item.label}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <p class="eyebrow">Feature Focus</p>
        <h2>不是堆功能，而是重排常用动作。</h2>
        <p>参考内容主要强调截图标注与启动器效率，我保留这个方向，并把翻译、剪贴板与钉图放到同一工作流里表达。</p>
      </div>
      <div class="feature-grid">
        ${features
          .map(
            (item) => `
              <article class="feature-card">
                <h3>${item.title}</h3>
                <p>${item.body}</p>
                <div class="chip-row">
                  ${item.chips.map((chip) => `<span class="chip">${chip}</span>`).join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <p class="eyebrow">Prototype</p>
        <h2>先给出一个能打开评审的界面原型。</h2>
        <p>SVG 原型图可直接在浏览器中打开，适合继续迭代主窗口、截图工具栏和底部状态区。</p>
      </div>
      <div class="proof-grid">
        <article class="proof-card">
          <h3>这轮产出</h3>
          <p>首页负责产品表达，更新日志负责记录测试节奏，原型图负责承接界面细化。三者已打通。</p>
          <div class="release-actions">
            <a class="button primary" href="/prototype/">打开原型页</a>
            <a class="button secondary" href="/prototypes/geke-workbench.svg" target="_blank" rel="noreferrer">直接打开 SVG</a>
          </div>
        </article>
        <article class="proof-card">
          <h3>参考依据</h3>
          <ol>
            ${proofPoints.map((point) => `<li>${point}</li>`).join("")}
          </ol>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <p class="eyebrow">Recent Releases</p>
        <h2>更新日志先独立出来，方便持续发测试版。</h2>
        <p>现在先写入 3 个测试版条目，后续可以直接挂 GitHub Releases 或下载地址。</p>
      </div>
      <div class="release-grid">
        ${releaseCards(3)}
      </div>
      <div class="release-actions">
        <a class="button secondary" href="/changelog/">查看完整日志</a>
      </div>
    </section>
  `,
  "home",
);

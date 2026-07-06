import { fuguangSummary, implementedFeatures, product } from "./data.js";
import { pageShell } from "./shared.js";

const app = document.querySelector("#app");

app.innerHTML = pageShell(
  `
    <section class="section page-panel">
      <div class="section-head">
        <p class="eyebrow">About GEKE</p>
        <h1>${product.nameCn} ${product.nameEn} 功能说明</h1>
        <p>这一页只归档参考摘要、当前实现范围和本地数据策略，方便评审，不再承担主入口。</p>
      </div>
      <div class="info-grid">
        <article class="info-card">
          <h2>浮光公开可见功能摘要</h2>
          <div class="stack-list">
            ${fuguangSummary
              .map(
                (item) => `
                  <div class="stack-item">
                    <strong>${item.title}</strong>
                    <p>${item.body}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
        <article class="info-card">
          <h2>GEKE 本轮已实现</h2>
          <ul class="bullet-list">
            ${implementedFeatures.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
        <article class="info-card">
          <h2>数据与安全</h2>
          <ul class="bullet-list">
            <li>Renderer 不启用 <code>nodeIntegration</code>，所有能力通过 <code>preload + contextBridge</code> 暴露。</li>
            <li>记录与设置写入 Electron <code>userData</code> 目录下的 <code>workspace-data.json</code>。</li>
            <li>当前自动收集的是文本剪贴板历史，不读取用户私有配置文件。</li>
            <li>OCR、录屏、长截图等系统权限能力没有伪装实现，仍在后续范围内。</li>
          </ul>
        </article>
      </div>
    </section>
  `,
  "about",
);

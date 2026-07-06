import { changelog, product } from "./data.js";
import { pageShell } from "./shared.js";

const app = document.querySelector("#app");

app.innerHTML = pageShell(
  `
    <section class="section page-panel">
      <div class="section-head">
        <p class="eyebrow">Release Notes</p>
        <h1>${product.nameCn} ${product.nameEn} 更新日志</h1>
        <p>这里只保留公开版本说明。真正的主入口已经切到工作台，更新日志只承担迭代记录与验收痕迹。</p>
      </div>
      <div class="timeline-layout">
        <aside class="timeline-nav">
          <h2>版本索引</h2>
          ${changelog
            .map((item) => `<a href="#v-${item.version.replace(/\./g, "-")}">v${item.version} · ${item.label}</a>`)
            .join("")}
        </aside>
        <div class="timeline-list">
          ${changelog
            .map(
              (item) => `
                <article class="timeline-card" id="v-${item.version.replace(/\./g, "-")}">
                  <div class="timeline-meta">
                    <span class="timeline-badge">${item.label}</span>
                    <span>${item.date}</span>
                    <span>Build ${item.build}</span>
                  </div>
                  <h3>v${item.version}</h3>
                  <p>${item.summary}</p>
                  <ul>
                    ${item.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
                  </ul>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `,
  "changelog",
);

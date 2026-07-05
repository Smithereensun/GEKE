import { changelog, product } from "./data.js";
import { pageShell } from "./shared.js";

const app = document.querySelector("#app");

app.innerHTML = pageShell(
  `
    <section class="section">
      <div class="section-head">
        <p class="eyebrow">Release Notes</p>
        <h1>${product.nameCn} ${product.nameEn} 更新日志</h1>
        <p>记录测试版站点与当前 Electron Mac App 的公开迭代。当前页面先承接版本说明，后续可与 GitHub Releases 同步。</p>
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

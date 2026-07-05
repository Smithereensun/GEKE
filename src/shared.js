import { changelog, product } from "./data.js";

export function pageShell(content, active = "home") {
  return `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" href="/">
          <span class="brand-mark">G</span>
          <span>${product.nameCn} ${product.nameEn}</span>
        </a>
        <nav class="nav">
          <a href="/" class="${active === "home" ? "active" : ""}">首页</a>
          <a href="/changelog/" class="${active === "changelog" ? "active" : ""}">更新日志</a>
          <a href="/prototype/" class="${active === "prototype" ? "active" : ""}">原型图</a>
        </nav>
      </header>
      ${content}
      <footer class="footer">
        <div>GEKE / 极刻 Mac App 测试版</div>
        <div class="footer-links">
          <a href="/">产品页</a>
          <a href="/changelog/">版本日志</a>
          <a href="/prototype/">原型图</a>
        </div>
      </footer>
    </div>
  `;
}

export function releaseCards(limit = 3) {
  return changelog
    .slice(0, limit)
    .map(
      (item) => `
        <article class="release-card">
          <span class="release-date">${item.date}</span>
          <h3>v${item.version}</h3>
          <p>${item.summary}</p>
          <ul>
            ${item.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

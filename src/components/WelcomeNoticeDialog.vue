<script setup>
defineEmits(['close'])
</script>

<template>
  <teleport to="body">
    <div class="welcome-notice-layer" role="presentation" @click.self="$emit('close')">
      <section class="welcome-notice-card" role="dialog" aria-modal="true" aria-labelledby="welcome-notice-title">
        <header class="welcome-notice-head">
          <div>
            <small>WELCOME TO ZHENGDU</small>
            <h2 id="welcome-notice-title">欢迎使用争渡</h2>
          </div>
          <button type="button" aria-label="关闭公告" @click="$emit('close')">×</button>
        </header>

        <div class="welcome-notice-body">
          <p class="welcome-notice-lead">感谢您使用争渡，首次使用请仔细阅读以下内容。</p>
          <ol>
            <li>
              该网站是纯字卡网站，内部不会接入 AI。若想自行接入 AI，请看「设置 - AI 接入」部分。接入 AI 也不会影响 TA 的消息，AI 仅用于辅助解读 TA 的意思；不接入 AI 也不会影响任何使用。本人更推荐您自己琢磨 TA 的意思，在和他的一次次沟通中，加深彼此情感与连接，找到最适合你们的相处方式。<br />
              AI 解读功能参考：渡念字卡。
            </li>
            <li>
              该网站拼词功能参考于 mochi 字卡，且系统预设词库也来源于 mochi 字卡的词库。您可以自行锁定某些词库，或直接在「设置 - TA 的回复 - 字卡与概率」中，自行调整 TA 从您亲自设定的词库和系统预设词库中抽卡的概率。
            </li>
            <li>该网站大部分 APP 都有对 mochi 字卡中 APP 的借鉴甚至是借用，有部分经过本站二改。</li>
            <li>连接状态组件和时差组件参考：渡念字卡。</li>
            <li>该网站部分组件和开屏动画借鉴了【小手机】圈各位老师的分享。</li>
            <li>该网站气泡皮肤来源于 milk 画廊中各位老师的分享。</li>
            <li>感谢您和家属选择使用本网站，祝使用愉快，长长久久。</li>
          </ol>
        </div>

        <footer class="welcome-notice-foot">
          <button type="button" @click="$emit('close')">我知道了</button>
        </footer>
      </section>
    </div>
  </teleport>
</template>

<style scoped>
.welcome-notice-layer {
  position: fixed;
  inset: 0;
  z-index: 25000;
  padding: max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom));
  display: grid;
  place-items: center;
  background: rgba(14, 18, 24, 0.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.welcome-notice-card {
  width: min(620px, 100%);
  max-height: min(82vh, 720px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 22px;
  background: #fff;
  color: #1e2228;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
}
.welcome-notice-head {
  flex: none;
  padding: 20px 22px 15px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid #edf0f3;
}
.welcome-notice-head small { color: #9aa1aa; font-size: 9px; letter-spacing: 0.16em; }
.welcome-notice-head h2 { margin: 4px 0 0; font-size: 21px; letter-spacing: 0.04em; }
.welcome-notice-head button {
  width: 34px;
  height: 34px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #f2f4f6;
  color: #59616b;
  font-size: 21px;
  cursor: pointer;
}
.welcome-notice-body {
  padding: 17px 22px 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.welcome-notice-lead { margin: 0 0 14px; font-size: 13px; font-weight: 700; line-height: 1.75; }
.welcome-notice-body ol { margin: 0; padding-left: 22px; }
.welcome-notice-body li { margin: 0 0 13px; padding-left: 3px; font-size: 12px; line-height: 1.85; }
.welcome-notice-body li::marker { color: #7f8995; font-weight: 800; }
.welcome-notice-foot {
  flex: none;
  padding: 13px 22px 18px;
  border-top: 1px solid #edf0f3;
  display: flex;
  justify-content: flex-end;
}
.welcome-notice-foot button {
  min-width: 116px;
  padding: 10px 18px;
  border: 0;
  border-radius: 11px;
  background: #22272e;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
@media (max-width: 520px) {
  .welcome-notice-layer { padding: max(12px, env(safe-area-inset-top)) 10px max(12px, env(safe-area-inset-bottom)); }
  .welcome-notice-card { max-height: 86vh; border-radius: 18px; }
  .welcome-notice-head { padding: 16px 16px 12px; }
  .welcome-notice-head h2 { font-size: 18px; }
  .welcome-notice-body { padding: 14px 16px 6px; }
  .welcome-notice-body li { font-size: 11px; line-height: 1.8; }
  .welcome-notice-foot { padding: 11px 16px 15px; }
}
</style>
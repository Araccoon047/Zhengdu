<script setup>
import { computed } from 'vue'
import { SPRING_BACKGROUND_URL, splashPresetById } from '../splash'
import '../splash-legacy.css'

const props = defineProps({
  presetId: { type: String, default: 'none' },
  config: { type: Object, default: () => ({}) },
  preview: Boolean,
  ready: Boolean,
})
const emit = defineEmits(['enter'])

const preset = computed(() => splashPresetById(props.presetId))
const kind = computed(() => preset.value.kind)
const springCharacters = computed(() => Array.from(String(props.config.chinese || '')))
const mobiusKey = computed(() => props.presetId === 'mobius2' ? 'two' : 'one')
const mobiusFrontPathId = computed(() => `splash-mobius-front-${mobiusKey.value}`)
const mobiusBackPathId = computed(() => `splash-mobius-back-${mobiusKey.value}`)
const mobiusLoveGradientId = computed(() => `splash-mobius-love-${mobiusKey.value}`)
const mobiusHateGradientId = computed(() => `splash-mobius-hate-${mobiusKey.value}`)
const springStyle = computed(() => ({
  '--spring-text': props.config.textColor || '#fff7fa',
  '--spring-accent': props.config.accentColor || '#ffd1dc',
}))

function requestEnter() {
  if (props.ready) emit('enter')
}
const springPetalPositions = [20, 40, 60, 80]
const springPetalDelays = [0, 2, 4, 1.5]
function springCharClass(index) {
  const framed = [2, 3, 10, 11].includes(index)
  return {
    highlight: framed,
    'art-frame': framed,
    hollow: [0, 4, 8].includes(index),
    gradient: [5, 9].includes(index),
    blur: [1, 6].includes(index),
    up: index % 2 === 0,
    down: index % 2 === 1,
  }
}
</script>

<template>
  <section
    class="launch-splash"
    :class="[`splash-${kind}`, { 'is-preview': preview, 'is-ready': ready, 'spring-two': presetId === 'spring2', 'mobius-two': presetId === 'mobius2' }]"
    aria-label="开屏动画"
    @click="requestEnter"
  >
    <div v-if="kind === 'mobius'" class="mobius-stage">
        <div class="mobius-particle-layer">
          <span v-for="index in 5" :key="index" class="mobius-particle" :class="`mobius-particle-${index}`"></span>
          <svg class="mobius-star mobius-star-top" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" fill="#d32f2f" opacity=".8" />
          </svg>
          <svg class="mobius-star mobius-star-bottom" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" fill="#7e57c2" opacity=".6" />
          </svg>
        </div>

      <div class="mobius-shell">
        <span class="mobius-decorative-line mobius-line-top"></span>
        <span class="mobius-decorative-line mobius-line-bottom"></span>

        <div class="mobius-copy">
          <h2>{{ config.title }}</h2>
          <p>{{ config.quote }}</p>
        </div>

        <svg class="mobius-svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <path :id="mobiusFrontPathId" d="M 400,225 C 550,50 750,100 750,225 C 750,350 550,400 400,225 C 250,50 50,100 50,225 C 50,350 250,400 400,225" />
            <path :id="mobiusBackPathId" d="M 400,225 C 250,400 50,350 50,225 C 50,100 250,50 400,225 C 550,400 750,350 750,225 C 750,100 550,50 400,225" />
            <linearGradient :id="mobiusLoveGradientId" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#8e0000" />
              <stop offset="50%" stop-color="#ff1744" />
              <stop offset="100%" stop-color="#8e0000" />
            </linearGradient>
            <linearGradient :id="mobiusHateGradientId" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#311b92" />
              <stop offset="50%" stop-color="#b388ff" />
              <stop offset="100%" stop-color="#311b92" />
            </linearGradient>
          </defs>

          <text class="mobius-path-shadow">
            <textPath :href="'#' + mobiusFrontPathId" startOffset="0%">
              AMOR ET ODIUM IN AETERNUM NEXI · SANGUIS ET LACRIMAE FLUUNT IN IDEM MARE
              <animate attributeName="startOffset" from="0%" to="100%" begin="0s" dur="40s" repeatCount="indefinite" />
            </textPath>
          </text>
          <text class="mobius-path-hate">
            <textPath :href="'#' + mobiusBackPathId" startOffset="100%">
              Odi et amo. Quare id faciam, fortasse requiris. Nescio, sed fieri sentio et excrucior.
              <animate attributeName="startOffset" from="100%" to="0%" begin="0s" dur="45s" repeatCount="indefinite" />
            </textPath>
          </text>
          <text class="mobius-path-love">
            <textPath :href="'#' + mobiusFrontPathId" startOffset="0%">
              TO DEVOUR IS TO PRESERVE · THE WOUND IS THE ONLY PROOF OF THE EMBRACE
              <animate attributeName="startOffset" from="0%" to="100%" begin="0s" dur="35s" repeatCount="indefinite" />
            </textPath>
          </text>
          <text class="mobius-path-love" :fill="'url(#' + mobiusLoveGradientId + ')'" opacity=".5">
            <textPath :href="'#' + mobiusFrontPathId" startOffset="50%">
              TO DEVOUR IS TO PRESERVE · THE WOUND IS THE ONLY PROOF OF THE EMBRACE
              <animate attributeName="startOffset" from="50%" to="150%" begin="0s" dur="35s" repeatCount="indefinite" />
            </textPath>
          </text>
          <text class="mobius-path-hate" :fill="'url(#' + mobiusHateGradientId + ')'" opacity=".4">
            <textPath :href="'#' + mobiusBackPathId" startOffset="50%">
              Odi et amo. Quare id faciam, fortasse requiris. Nescio, sed fieri sentio et excrucior.
              <animate attributeName="startOffset" from="50%" to="-50%" begin="0s" dur="45s" repeatCount="indefinite" />
            </textPath>
          </text>
        </svg>
      </div>
    </div>
    <div v-else-if="kind === 'spring'" class="spring-stage is-visible" :style="springStyle">
      <div class="spring-background" :style="{ backgroundImage: 'url(' + SPRING_BACKGROUND_URL + ')' }"></div>
      <div class="spring-fine-corners"></div>
      <div class="spring-folded-lines"></div>
      <span
        v-for="(left, index) in springPetalPositions"
        :key="index"
        class="spring-petal"
        :style="{ left: left + '%', animationDelay: springPetalDelays[index] + 's' }"
      ></span>
      <div class="spring-copy">
        <div class="spring-english">{{ config.english }}</div>
        <div class="spring-chinese">
          <span v-for="(char, index) in springCharacters" :key="index" class="spring-char" :class="springCharClass(index)" :style="{ '--spring-delay': (0.3 + index * 0.1) + 's' }">{{ char }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="kind === 'bitterOrange'" class="orange-stage">
      <div class="orange-fit">
      <div class="orange-canvas is-visible">
        <div class="orange-ripple orange-abs">
          <span>{{ config.lead }}</span>
          <i></i><i></i><i></i>
        </div>
        <div class="orange-copy orange-abs">
          <small>{{ config.small }}</small>
          <strong :data-text="config.accent" :style="{ color: config.accentColor }">{{ config.accent }}</strong>
        </div>
        <div class="orange-english orange-abs" :style="{ color: config.englishColor }">{{ config.english }}</div>
        <div class="orange-route route-a orange-abs"></div>
        <div class="orange-route route-b orange-abs"></div>
        <div class="orange-route route-c orange-abs"></div>
        <span class="orange-node node-a orange-abs"></span>
        <span class="orange-node node-b orange-abs"></span>
        <span class="orange-node node-c orange-abs"></span>
        <span class="orange-node node-d target orange-abs"></span>
        <span class="orange-route-label label-a orange-abs">[ROUTE_INIT]</span>
        <span class="orange-route-label label-b orange-abs">LAT.42°15'N</span>
        <span class="orange-route-label label-c orange-abs">TARGET//<br>LOCKED</span>
        <div class="orange-images">
          <div v-if="config.primaryImage" class="orange-image primary"><img :src="config.primaryImage" alt="" /></div>
          <div v-if="config.secondaryImage" class="orange-image secondary"><img :src="config.secondaryImage" alt="" /></div>
        </div>
      </div>
      </div>
    </div>
    <div v-if="ready && !preview" class="splash-enter-hint">轻触屏幕进入</div>
  </section>
</template>

<style>
.launch-splash {
  position: fixed;
  inset: 0;
  z-index: 30000;
  display: grid;
  place-items: center;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  background: #090a10;
  isolation: isolate;
}
.launch-splash.is-ready { cursor: pointer; }
.splash-enter-hint {
  position: absolute;
  left: 50%;
  bottom: max(24px, env(safe-area-inset-bottom));
  z-index: 20;
  transform: translateX(-50%);
  padding: 7px 15px;
  border: 1px solid rgba(255, 255, 255, .22);
  border-radius: 999px;
  background: rgba(10, 10, 15, .34);
  color: rgba(255, 255, 255, .86);
  font-size: clamp(9px, 2.6vw, 11px);
  letter-spacing: .12em;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: splash-enter-pulse 1.7s ease-in-out infinite;
}
@keyframes splash-enter-pulse {
  0%, 100% { opacity: .55; transform: translateX(-50%) translateY(2px); }
  50% { opacity: 1; transform: translateX(-50%) translateY(-2px); }
}
.launch-splash.is-preview {
  position: relative;
  inset: auto;
  width: 100%;
  height: auto;
  min-height: 230px;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
}
.launch-splash.splash-bitterOrange.is-preview{width:100%;height:240px;min-height:240px;aspect-ratio:auto;margin:0 auto}
.mobius-stage,.spring-stage,.orange-stage{position:relative;width:100%;height:100%;overflow:hidden;display:grid;place-items:center;padding:max(14px,env(safe-area-inset-top)) clamp(14px,4vw,24px) max(14px,env(safe-area-inset-bottom));background:#080b11;box-sizing:border-box}
.orange-canvas{position:relative;display:flex;flex-direction:column;align-items:flex-end;width:min(100%,560px);min-height:180px;padding-top:28px;margin-bottom:24px;gap:16px;overflow:visible;isolation:isolate;box-sizing:border-box}
.orange-canvas *{animation-timing-function:cubic-bezier(.22,1,.36,1);animation-fill-mode:both}
.orange-abs{position:absolute;pointer-events:none}
.orange-ripple{left:5%;top:5%;width:120px;height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:5;transform-origin:top left;color:#fff;font-family:'Songti SC',SimSun,serif;font-size:32px}
.orange-ripple>span{position:relative;z-index:10;padding-left:10px;padding-top:5px;text-shadow:0 1px 3px rgba(0,0,0,.2)}
.orange-ripple i{position:absolute;left:0;top:0;width:40px;height:40px;border:1px solid rgba(138,180,248,.45);border-radius:50%;transform:translate(-50%,-50%) scale(0);opacity:0}
.orange-copy{left:25%;top:41%;z-index:11;display:flex;align-items:baseline;gap:6px;font-family:'Songti SC',SimSun,serif;text-shadow:0 1px 2px rgba(0,0,0,.2)}
.orange-copy small{color:rgba(255,255,255,.85);font-size:13px;letter-spacing:2px}
.orange-copy strong{position:relative;font-size:28px;letter-spacing:1px;line-height:1;transform:translateY(15px)}
.orange-copy strong::after{content:attr(data-text);position:absolute;left:-4px;top:6px;color:transparent;-webkit-text-stroke:1px rgba(255,192,151,.4);z-index:-1;text-shadow:none}
.orange-english{left:18%;top:14%;z-index:25;font-family:Georgia,'Times New Roman',serif;font-size:36px;letter-spacing:.01em;white-space:nowrap;text-shadow:1px 1px 2px rgba(0,0,0,.1)}
.orange-route{opacity:.5;z-index:20}
.route-a{left:5%;bottom:15%;width:30%;height:1px;background-image:linear-gradient(to right,rgba(255,255,255,.4) 50%,transparent 50%);background-size:6px 1px}
.route-b{left:35%;bottom:15%;width:1px;height:60%;background-color:rgba(255,255,255,.25)}
.route-c{left:35%;bottom:75%;width:55%;height:1px;background-color:rgba(255,255,255,.25)}
.orange-node{width:9px;height:9px;z-index:21}
.orange-node::before,.orange-node::after{content:'';position:absolute;background:rgba(255,255,255,.7)}
.orange-node::before{top:4px;left:0;width:100%;height:1px}
.orange-node::after{top:0;left:4px;width:1px;height:100%}
.orange-node.target{width:5px;height:5px;background:#fff;box-shadow:0 0 4px rgba(255,255,255,.5)}
.orange-node.target::before,.orange-node.target::after{display:none}
.node-a{left:5%;bottom:15%}.node-b{left:35%;bottom:15%}.node-c{left:35%;bottom:75%}.node-d{left:90%;bottom:75%}
.orange-route-label{z-index:20;color:rgba(255,255,255,.4);font-family:'Courier New',monospace;font-size:9px;letter-spacing:1px;line-height:1.15;white-space:nowrap}
.label-a{left:5%;bottom:17%}.label-b{left:36%;bottom:77%}.label-c{left:81%;bottom:70%;color:rgba(255,255,255,.6);text-align:right}
.orange-images{position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:16px;width:100%;z-index:9}
.orange-image{position:relative;box-sizing:border-box;flex:none}
.orange-image.primary{width:40%;aspect-ratio:3/1;z-index:10}.orange-image.secondary{width:50%;aspect-ratio:4/1;z-index:9}
.orange-image::before{content:'';position:absolute;top:-10px;left:-10px;width:100%;height:100%;border:1px solid rgba(255,255,255,.25);z-index:-1;pointer-events:none}
.orange-image img{position:relative;z-index:2;width:100%;height:100%;object-fit:cover;object-position:center;display:block;box-shadow:0 6px 16px rgba(0,0,0,.25);border-radius:0!important}
.orange-ripple,.orange-copy,.orange-english,.orange-route,.orange-route-label,.orange-node,.orange-image{opacity:0}
.is-visible .orange-ripple{animation:orange-ripple-in 1s cubic-bezier(.22,1,.36,1) .3s forwards,orange-ripple-float 6s ease-in-out 1.3s infinite}
.is-visible .orange-ripple i{animation:orange-circle-expand 4s cubic-bezier(.22,1,.36,1) infinite}
.is-visible .orange-ripple i:nth-of-type(1){animation-delay:0s}.is-visible .orange-ripple i:nth-of-type(2){animation-delay:1.2s}.is-visible .orange-ripple i:nth-of-type(3){animation-delay:2.4s}
.is-visible .orange-copy{animation:orange-fade-up .9s cubic-bezier(.22,1,.36,1) .7s forwards,orange-float-light 5s ease-in-out 1.6s infinite reverse}
.is-visible .orange-english{animation:orange-sea-in 1.2s cubic-bezier(.22,1,.36,1) .9s forwards,orange-rock 6s ease-in-out 2.1s infinite}
.is-visible .orange-route,.is-visible .orange-route-label{animation:orange-fade-up 1s cubic-bezier(.22,1,.36,1) .4s forwards}
.is-visible .orange-node{animation:orange-node-pop .5s cubic-bezier(.22,1,.36,1) .55s forwards}
.is-visible .orange-image.primary{animation:orange-fade-up .8s cubic-bezier(.22,1,.36,1) 0s forwards,orange-float-heavy 8s ease-in-out .8s infinite}
.is-visible .orange-image.secondary{animation:orange-fade-up .8s cubic-bezier(.22,1,.36,1) .15s forwards,orange-float-heavy 7s ease-in-out .95s infinite reverse}
@keyframes orange-fade-up{0%{opacity:0;transform:translateY(20px);filter:blur(4px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}
@keyframes orange-ripple-in{0%{opacity:0;transform:scale(.8) translateY(20px);filter:blur(4px)}100%{opacity:1;transform:scale(.8) translateY(0);filter:blur(0)}}
@keyframes orange-sea-in{0%{opacity:0;transform:rotate(-3deg) translateY(20px);filter:blur(4px)}100%{opacity:.9;transform:rotate(-3deg) translateY(0);filter:blur(0)}}
@keyframes orange-node-pop{0%{opacity:0;transform:translate(-50%,50%) scale(.2)}100%{opacity:1;transform:translate(-50%,50%) scale(1)}}
@keyframes orange-circle-expand{0%{transform:translate(-50%,-50%) scale(0);opacity:1;border-width:1.5px}80%{opacity:.1}100%{transform:translate(-50%,-50%) scale(5);opacity:0;border-width:.5px}}
@keyframes orange-float-heavy{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:1;transform:translateY(-8px)}}
@keyframes orange-float-light{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
@keyframes orange-ripple-float{0%,100%{opacity:1;transform:scale(.8) translateY(0)}50%{opacity:1;transform:scale(.8) translateY(-5px)}}
@keyframes orange-rock{0%,100%{opacity:.9;transform:rotate(-3deg) translateY(0)}50%{opacity:.9;transform:rotate(-4deg) translateY(-2px)}}
/* 苦橙只让纯色背景铺满，所有关联组件在固定设计画布内等比缩放。 */
.orange-stage{padding:0;display:grid;place-items:center;background:#080b11;overflow:hidden}
.orange-fit{width:min(calc(100% - 24px),560px);aspect-ratio:560/240;container-type:inline-size;display:grid;place-items:center}
.orange-canvas{width:100%;height:100%;min-height:0;padding:5cqw 0 0;margin:0;gap:2.857cqw;align-items:flex-end;overflow:visible}
.orange-ripple{width:21.43cqw;height:21.43cqw;font-size:5.714cqw}
.orange-ripple>span{padding-left:1.786cqw;padding-top:.893cqw}
.orange-ripple i{width:7.143cqw;height:7.143cqw;border-width:.179cqw}
.orange-copy{gap:1.071cqw}.orange-copy small{font-size:2.321cqw;letter-spacing:.357cqw}.orange-copy strong{font-size:5cqw;letter-spacing:.179cqw;transform:translateY(2.679cqw)}.orange-copy strong::after{left:-.714cqw;top:1.071cqw;-webkit-text-stroke:.179cqw rgba(255,192,151,.4)}
.orange-english{font-size:6.429cqw;letter-spacing:.018em}
.orange-node{width:1.607cqw;height:1.607cqw}.orange-node::before{top:.714cqw;height:.179cqw}.orange-node::after{left:.714cqw;width:.179cqw}.orange-node.target{width:.893cqw;height:.893cqw}
.orange-route-label{font-size:1.607cqw;letter-spacing:.179cqw;line-height:1.15}
.orange-images{gap:2.857cqw}.orange-image::before{top:-1.786cqw;left:-1.786cqw;border-width:.179cqw}.orange-image img{box-shadow:0 1.071cqw 2.857cqw rgba(0,0,0,.25)}
.is-visible .orange-image.primary,.is-visible .orange-image.secondary{animation-name:orange-fade-up,orange-float-heavy}
@keyframes orange-fade-up{0%{opacity:0;transform:translateY(3.571cqw);filter:blur(4px)}100%{opacity:1;transform:translateY(0);filter:blur(0)}}
@keyframes orange-float-heavy{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:1;transform:translateY(-1.429cqw)}}
@keyframes orange-float-light{0%,100%{opacity:1;transform:translateY(0)}50%{opacity:1;transform:translateY(-.714cqw)}}
@keyframes orange-ripple-float{0%,100%{opacity:1;transform:scale(.8) translateY(0)}50%{opacity:1;transform:scale(.8) translateY(-.893cqw)}}
@supports not (width: 1cqw){.orange-fit{width:min(100%,560px);height:240px}.orange-ripple{width:clamp(54px,21.43vw,120px);height:clamp(54px,21.43vw,120px);font-size:clamp(15px,5.7vw,32px)}.orange-copy small{font-size:clamp(7px,2.32vw,13px)}.orange-copy strong{font-size:clamp(11px,5vw,28px)}.orange-english{font-size:clamp(14px,6.43vw,36px)}.orange-route-label{font-size:clamp(6px,1.61vw,9px)}}
</style>

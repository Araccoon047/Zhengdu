import bubbleOtherUrl from '../assets/theme/bubble-other.png'
import bubbleUserUrl from '../assets/theme/bubble-user.png'
import avatarDecorationUrl from '../assets/theme/avatar-decoration.png'
import bub_206f1716be85 from '../assets/bubbles/206f1716be85.png'
import bub_396c71b29594 from '../assets/bubbles/396c71b29594.png'
import bub_44e6e1763e6c from '../assets/bubbles/44e6e1763e6c.png'
import bub_4505d3596af0 from '../assets/bubbles/4505d3596af0.png'
import bub_48b6bc2738d6 from '../assets/bubbles/48b6bc2738d6.png'
import bub_541608375433 from '../assets/bubbles/541608375433.png'
import bub_71cdadb402e2 from '../assets/bubbles/71cdadb402e2.png'
import bub_73f21f087be5 from '../assets/bubbles/73f21f087be5.png'
import bub_796a0506e9b7 from '../assets/bubbles/796a0506e9b7.png'
import bub_806ced6edd4b from '../assets/bubbles/806ced6edd4b.png'
import bub_8177955a4559 from '../assets/bubbles/8177955a4559.png'
import bub_82787b9cb0a1 from '../assets/bubbles/82787b9cb0a1.png'
import bub_8c98de75b929 from '../assets/bubbles/8c98de75b929.png'
import bub_9466dec8ca0b from '../assets/bubbles/9466dec8ca0b.png'
import bub_9f8bd1bc17c1 from '../assets/bubbles/9f8bd1bc17c1.png'
import bub_afce082f2dd0 from '../assets/bubbles/afce082f2dd0.png'
import bub_b522fe363a27 from '../assets/bubbles/b522fe363a27.png'
import bub_b5aca6092dd2 from '../assets/bubbles/b5aca6092dd2.png'
import bub_b988545ac4dc from '../assets/bubbles/b988545ac4dc.png'
import bub_cddefac7e1fd from '../assets/bubbles/cddefac7e1fd.png'
import bub_d43ac1a1073c from '../assets/bubbles/d43ac1a1073c.png'
import bub_d8d4429b141a from '../assets/bubbles/d8d4429b141a.png'
import bub_ea9750157f75 from '../assets/bubbles/ea9750157f75.png'
import bub_f12e7edd737f from '../assets/bubbles/f12e7edd737f.png'
import bub_f676833722ce from '../assets/bubbles/f676833722ce.png'
import bub_fe37471118c6 from '../assets/bubbles/fe37471118c6.png'

export const BUBBLE_BASE_CSS = `
.echoes-bubble-user::before,
.echoes-bubble-other::before,
.echoes-bubble-user::after,
.echoes-bubble-other::after { display:none !important; content:none !important; }
.echoes-bubble-user,.echoes-bubble-other{
  opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  color:#171717!important;background:#fff!important;border:1px solid #dedede!important;
  border-radius:20px!important;box-shadow:0 3px 12px rgba(0,0,0,.06)!important;
  transform:translateY(21px)!important;
}
`

export const AVATAR_FRAME_BASE_CSS = `
.echoes-avatar-user::after,
.echoes-avatar-other::after { display:none !important; content:none !important; }
`

export const BUILTIN_BUBBLE_SKINS = [
  {
    id: 'default',
    name: '默认黑白气泡',
    description: '浅灰与纯白气泡，无装饰图',
    css: `
.echoes-bubble-user,.echoes-bubble-other{
  opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  color:#171717!important;border-radius:20px!important;position:relative!important;overflow:visible!important;
  box-shadow:0 3px 12px rgba(0,0,0,.07)!important;margin-top:0!important;transform:translateY(21px)!important;
}
.echoes-bubble-user{background:#f1f1f1!important;border:1px solid #d7d7d7!important}
.echoes-bubble-other{background:#ffffff!important;border:1px solid #dedede!important}
.echoes-bubble-user::before,.echoes-bubble-other::before{display:none!important;content:none!important}
`,
  },
  {
    id: 'echoes',
    name: '淡海蓝章气泡',
    description: '淡蓝气泡与海豹角落装饰',
    css: `
.echoes-bubble-user,.echoes-bubble-other{
  opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  color:#333!important;border-radius:24px!important;position:relative!important;overflow:visible!important;
  box-shadow:0 3px 12px rgba(105,177,255,.15)!important;margin-top:0!important;transform:translateY(21px)!important;
}
.echoes-bubble-user{background:#e0f2fe!important;border:1px solid #bae0ff!important}
.echoes-bubble-other{background:#fff!important;border:1px solid #e6f7ff!important}
.echoes-bubble-other::before,.echoes-bubble-user::before{
  content:""!important;display:block!important;position:absolute!important;pointer-events:none!important;z-index:2!important;
  background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;
}
.echoes-bubble-other::before{top:-28px;left:-20px;width:clamp(52px,15vw,66px);height:clamp(52px,15vw,66px);background-image:url("${bubbleOtherUrl}")!important;transform:rotate(-5deg)}
.echoes-bubble-user::before{top:-22px;right:-16px;width:clamp(42px,12vw,52px);height:clamp(42px,12vw,52px);background-image:url("${bubbleUserUrl}")!important;transform:rotate(4deg)}
`,
  },
  {
    id: 'youling',
    name: '幽灵小兔气泡',
    description: '白色发光气泡，星点与小兔贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;line-height:1.5!important;}
.echoes-bubble-user{background:rgba(255,255,255,.95)!important;border:none!important;border-radius:24px 24px 4px 24px!important;color:#1a1a1a!important;padding:8px 16px!important;box-shadow:0 0 12px rgba(255,255,255,.9),0 0 30px rgba(255,255,255,.6),0 0 60px rgba(255,255,255,.3),inset 0 0 15px rgba(255,255,255,1)!important;}
.echoes-bubble-other{background:rgba(255,255,255,.95)!important;border:none!important;border-radius:24px 24px 24px 4px!important;color:#1a1a1a!important;padding:8px 16px!important;box-shadow:0 0 12px rgba(255,255,255,.9),0 0 30px rgba(255,255,255,.6),0 0 60px rgba(255,255,255,.3),inset 0 0 15px rgba(255,255,255,1)!important;}
.echoes-bubble-user::before{content:"✦ ✧ ✦"!important;position:absolute!important;top:-8px!important;left:-10px!important;font-size:12px!important;color:#fff!important;text-shadow:0 0 6px #fff,0 0 10px #fff!important;z-index:1!important;pointer-events:none!important;transform:scaleX(-1) rotate(15deg)!important;}
.echoes-bubble-other::before{content:"✦ ✧ ✦"!important;position:absolute!important;top:-8px!important;right:-10px!important;font-size:12px!important;color:#fff!important;text-shadow:0 0 6px #fff,0 0 10px #fff!important;z-index:1!important;pointer-events:none!important;transform:rotate(15deg)!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;bottom:-3px!important;right:-10px!important;width:25px!important;height:25px!important;background:url("${bub_8c98de75b929}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;bottom:-3px!important;left:-10px!important;width:25px!important;height:25px!important;background:url("${bub_48b6bc2738d6}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;}
`,
  },
  {
    id: 'maotaotao-dynamic',
    name: '猫桃桃动态气泡',
    description: '胶囊粉白气泡，桃桃贴纸带呼吸动画',
    css: `
@keyframes bub-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;border:none!important;border-radius:999px!important;background:radial-gradient(ellipse 85% 50% at center,#ffe6ea 0%,transparent 50%),radial-gradient(ellipse 100% 70% at center,#fff 0%,transparent 60%),#fff!important;padding:6px 16px!important;color:#333!important;box-shadow:none!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:4px!important;left:-4px!important;width:16px!important;height:16px!important;background:url("${bub_b5aca6092dd2}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;animation:bub-pulse 2.5s ease-in-out infinite!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;top:4px!important;right:-4px!important;width:12px!important;height:100%!important;background:url("${bub_d43ac1a1073c}") top right/10px 10px no-repeat,url("${bub_4505d3596af0}") bottom right/12px 12px no-repeat!important;z-index:1!important;pointer-events:none!important;animation:bub-pulse 2.5s ease-in-out infinite!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:4px!important;right:-4px!important;width:16px!important;height:16px!important;background:url("${bub_b5aca6092dd2}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;animation:bub-pulse 2.5s ease-in-out infinite!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;top:4px!important;left:-4px!important;width:12px!important;height:100%!important;background:url("${bub_d43ac1a1073c}") top left/10px 10px no-repeat,url("${bub_4505d3596af0}") bottom left/12px 12px no-repeat!important;z-index:1!important;pointer-events:none!important;animation:bub-pulse 2.5s ease-in-out infinite!important;}
`,
  },
  {
    id: 'maotaotao-static',
    name: '猫桃桃静态气泡',
    description: '胶囊粉白气泡，静态桃桃贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;border:none!important;border-radius:999px!important;background:radial-gradient(ellipse 85% 50% at center,#ffe6ea 0%,transparent 50%),radial-gradient(ellipse 100% 70% at center,#fff 0%,transparent 60%),#fff!important;padding:6px 16px!important;color:#333!important;box-shadow:none!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:4px!important;left:-4px!important;width:16px!important;height:16px!important;background:url("${bub_b5aca6092dd2}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;top:4px!important;right:-4px!important;width:12px!important;height:100%!important;background:url("${bub_d43ac1a1073c}") top right/10px 10px no-repeat,url("${bub_4505d3596af0}") bottom right/12px 12px no-repeat!important;z-index:1!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:4px!important;right:-4px!important;width:16px!important;height:16px!important;background:url("${bub_b5aca6092dd2}") no-repeat center/contain!important;z-index:1!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;top:4px!important;left:-4px!important;width:12px!important;height:100%!important;background:url("${bub_d43ac1a1073c}") top left/10px 10px no-repeat,url("${bub_4505d3596af0}") bottom left/12px 12px no-repeat!important;z-index:1!important;pointer-events:none!important;}
`,
  },
  {
    id: 'ins',
    name: '半透明ins',
    description: '半透明白气泡，毛玻璃质感',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;background:rgba(255,255,255,.08)!important;border:.5px solid rgba(255,255,255,.12)!important;color:#fff!important;padding:7px 14px!important;box-shadow:0 2px 10px rgba(0,0,0,.35)!important;backdrop-filter:blur(17px)!important;-webkit-backdrop-filter:blur(17px)!important;}
.echoes-bubble-user{border-radius:18px 18px 4px 18px!important;}
.echoes-bubble-other{border-radius:18px 18px 18px 4px!important;}
.echoes-bubble-user::before,.echoes-bubble-other::before,.echoes-bubble-user::after,.echoes-bubble-other::after{display:none!important;content:none!important;}
`,
  },
  {
    id: 'fenbai',
    name: '粉白天使',
    description: '胶囊粉白气泡，天使贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;border:none!important;border-radius:999px!important;padding:6px 16px!important;color:#333!important;box-shadow:none!important;filter:drop-shadow(0 0 6px rgba(255,255,255,.95)) drop-shadow(0 0 14px rgba(255,255,255,.65))!important;}
.echoes-bubble-user{background:radial-gradient(ellipse 85% 50% at center,#fdd8e5 0%,transparent 50%),radial-gradient(ellipse 100% 70% at center,#fff0f6 0%,transparent 60%),#fff!important;}
.echoes-bubble-other{background:radial-gradient(ellipse 85% 50% at center,#fff 0%,transparent 50%),radial-gradient(ellipse 100% 70% at center,#fff 0%,transparent 60%),#fff!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:-20px!important;bottom:-20px!important;left:-30px!important;width:60px!important;background:url("${bub_d8d4429b141a}") 20px 18px/14px 14px no-repeat,url("${bub_806ced6edd4b}") 18px calc(100% - 21px)/18px 18px no-repeat!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;top:-20px!important;bottom:-20px!important;right:-20px!important;width:60px!important;background:url("${bub_73f21f087be5}") calc(100% - 10px) 18px/18px 18px no-repeat,url("${bub_b988545ac4dc}") calc(100% - 6px) calc(100% - 21px)/18px 18px no-repeat!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:-20px!important;bottom:-20px!important;left:-20px!important;width:60px!important;background:url("${bub_f676833722ce}") -2px 18px/24px 24px no-repeat,url("${bub_71cdadb402e2}") 8px calc(100% - 12px)/15px 15px no-repeat!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;top:-20px!important;bottom:-20px!important;right:-20px!important;width:60px!important;background:url("${bub_ea9750157f75}") calc(100% - 2px) 18px/24px 24px no-repeat,url("${bub_f12e7edd737f}") calc(100% - 8px) calc(100% - 12px)/15px 15px no-repeat!important;z-index:9!important;pointer-events:none!important;}
`,
  },
  {
    id: 'lengre',
    name: '冷脸萌热脸萌气泡',
    description: '浅灰渐变气泡，冷脸/热脸颜文字',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;border:none!important;border-radius:14px!important;color:#555!important;padding:6px 14px!important;box-shadow:0 2px 4px rgba(0,0,0,.1),0 6px 16px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.6)!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;}
.echoes-bubble-user{background:linear-gradient(135deg,rgba(248,248,248,.85) 0%,rgba(232,232,232,.8) 100%)!important;}
.echoes-bubble-other{background:linear-gradient(135deg,rgba(228,228,228,.85) 0%,rgba(208,208,208,.8) 100%)!important;}
.echoes-bubble-user::before,.echoes-bubble-other::before{display:none!important;content:none!important;}
.echoes-bubble-user::after{content:"˵＞𖥦＜˵"!important;position:absolute!important;top:-9px!important;left:-4px!important;font-size:10px!important;color:#000!important;background:transparent!important;white-space:nowrap!important;pointer-events:none!important;line-height:1!important;text-shadow:0 1px 2px rgba(255,255,255,.5)!important;}
.echoes-bubble-other::after{content:"˶ᗜ - ᗜ˶"!important;position:absolute!important;top:-9px!important;right:-4px!important;font-size:10px!important;color:#000!important;background:transparent!important;white-space:nowrap!important;pointer-events:none!important;line-height:1!important;text-shadow:0 1px 2px rgba(255,255,255,.5)!important;}
`,
  },
  {
    id: 'baitu',
    name: '白色兔兔',
    description: '白色立体气泡，兔兔贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;line-height:1.4!important;color:#555!important;padding:8px 16px!important;border:none!important;border-radius:20px!important;background:radial-gradient(ellipse at 50% 30%,#fff 0%,#f9f9f9 60%,#eee 100%)!important;box-shadow:inset 0 5px 8px rgba(255,255,255,1),inset 0 -4px 8px rgba(200,200,200,.25),0 0 12px rgba(255,255,255,.7),0 0 25px rgba(255,255,255,.4)!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:-12px!important;left:-6px!important;width:24px!important;height:24px!important;background:url("${bub_796a0506e9b7}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;bottom:-8px!important;right:-2px!important;width:24px!important;height:24px!important;background:url("${bub_afce082f2dd0}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:-14px!important;right:-6px!important;width:24px!important;height:24px!important;background:url("${bub_541608375433}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;bottom:-6px!important;left:-6px!important;width:24px!important;height:24px!important;background:url("${bub_afce082f2dd0}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
`,
  },
  {
    id: 'wenre',
    name: '热脸萌温脸萌',
    description: '浅灰渐变气泡，温脸/热脸颜文字',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;border:none!important;border-radius:14px!important;color:#555!important;padding:6px 14px!important;box-shadow:0 2px 4px rgba(0,0,0,.1),0 6px 16px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.6)!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;}
.echoes-bubble-user{background:linear-gradient(135deg,rgba(248,248,248,.85) 0%,rgba(232,232,232,.8) 100%)!important;}
.echoes-bubble-other{background:linear-gradient(135deg,rgba(228,228,228,.85) 0%,rgba(208,208,208,.8) 100%)!important;}
.echoes-bubble-user::before,.echoes-bubble-other::before{display:none!important;content:none!important;}
.echoes-bubble-user::after{content:"ᯇᴗᯇ"!important;position:absolute!important;top:-9px!important;left:-4px!important;font-size:10px!important;color:#000!important;background:transparent!important;white-space:nowrap!important;pointer-events:none!important;line-height:1!important;text-shadow:0 1px 2px rgba(255,255,255,.5)!important;}
.echoes-bubble-other::after{content:"˵＞𖥦＜˵"!important;position:absolute!important;top:-9px!important;right:-4px!important;font-size:10px!important;color:#000!important;background:transparent!important;white-space:nowrap!important;pointer-events:none!important;line-height:1!important;text-shadow:0 1px 2px rgba(255,255,255,.5)!important;}
`,
  },
  {
    id: 'shuise',
    name: '水色小八吉伊',
    description: '水色渐变气泡，小八吉伊贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;line-height:1.5!important;color:#7b8fa6!important;padding:8px 24px!important;border-radius:20px!important;background:linear-gradient(180deg,#d9ecff 0%,#eaf5ff 8%,#fff 30%,#fff 100%)!important;box-shadow:0 0 0 8px rgba(255,255,255,1),0 0 0 9px rgba(214,233,255,.4),0 10px 24px rgba(180,210,240,.35),0 0 20px rgba(214,233,255,.5),0 0 40px rgba(214,233,255,.25)!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:-20px!important;right:-8px!important;width:43px!important;height:43px!important;background:url("${bub_82787b9cb0a1}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;top:-6px!important;left:-6px!important;width:28px!important;height:28px!important;background:url("${bub_fe37471118c6}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:-20px!important;left:-6px!important;width:38px!important;height:38px!important;background:url("${bub_9f8bd1bc17c1}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;top:-3px!important;right:-5px!important;width:25px!important;height:25px!important;background:url("${bub_44e6e1763e6c}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
`,
  },
  {
    id: 'tianxin',
    name: '甜心骨',
    description: '粉白气泡，骨头贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;box-shadow:none!important;border-width:0!important;font-weight:500!important;}
.echoes-bubble-user{background:#fff!important;border:1.5px solid #888!important;color:#666!important;border-radius:3px!important;padding:5px 15px!important;}
.echoes-bubble-other{background:#fef0f5!important;border:1.5px solid #888!important;color:#666!important;border-radius:3px!important;padding:5px 15px!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:-7px!important;right:-8px!important;width:20px!important;height:20px!important;background:url("${bub_396c71b29594}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;bottom:-16px!important;left:-15px!important;width:45px!important;height:45px!important;background:url("${bub_cddefac7e1fd}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:-7px!important;left:-8px!important;width:20px!important;height:20px!important;background:url("${bub_206f1716be85}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;bottom:-16px!important;right:-25px!important;width:45px!important;height:45px!important;background:url("${bub_cddefac7e1fd}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
`,
  },
  {
    id: 'xiemao',
    name: '邪恶猫猫',
    description: '半透明白气泡，猫猫贴纸',
    css: `
.echoes-bubble-user,.echoes-bubble-other{opacity:1!important;position:relative!important;overflow:visible!important;margin-top:0!important;transform:translateY(21px)!important;background:rgba(255,255,255,.75)!important;color:#666!important;padding:7px 14px!important;border:.5px solid #fff!important;box-shadow:0 2px 6px #ccc,inset 0 0 0 .5px #fff,0 0 10px rgba(255,255,255,.9),0 0 20px rgba(255,255,255,.6),0 0 35px rgba(255,255,255,.4),0 0 55px rgba(255,255,255,.2)!important;backdrop-filter:blur(17px)!important;-webkit-backdrop-filter:blur(17px)!important;}
.echoes-bubble-user{border-radius:18px 18px 4px 18px!important;}
.echoes-bubble-other{border-radius:18px 18px 18px 4px!important;}
.echoes-bubble-user::before{content:""!important;position:absolute!important;top:-15px!important;left:-5px!important;width:32px!important;height:32px!important;background:url("${bub_9466dec8ca0b}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-user::after{content:""!important;position:absolute!important;bottom:-5px!important;right:-5px!important;width:19px!important;height:19px!important;background:url("${bub_8177955a4559}") no-repeat center/contain!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::before{content:""!important;position:absolute!important;top:-15px!important;right:-5px!important;width:32px!important;height:32px!important;background:url("${bub_b522fe363a27}") no-repeat center/contain!important;transform:scaleX(-1)!important;z-index:9!important;pointer-events:none!important;}
.echoes-bubble-other::after{content:""!important;position:absolute!important;bottom:-5px!important;left:-5px!important;width:19px!important;height:19px!important;background:url("${bub_8177955a4559}") no-repeat center/contain!important;transform:scaleX(-1)!important;z-index:9!important;pointer-events:none!important;}
`,
  },
]

export const BUILTIN_AVATAR_FRAME_SKINS = [
  { id: 'none', name: '无头像框', description: '不显示任何头像框', css: '' },
  {
    id: 'echoes',
    name: '淡海蓝章头像框',
    description: '淡蓝装饰头像框',
    css: `
.echoes-avatar-user::after,.echoes-avatar-other::after{
  content:""!important;display:block!important;position:absolute!important;top:20%!important;left:50%!important;
  width:clamp(58px,16vw,70px)!important;height:clamp(58px,16vw,70px)!important;
  transform:translate(-50%,-50%)!important;background:url("${avatarDecorationUrl}") no-repeat center/contain!important;
  pointer-events:none!important;z-index:5!important;
}
`,
  },
]